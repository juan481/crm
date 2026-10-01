import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const MONTH_RE = /^\d{4}-\d{2}$/

// Objetivos de venta por mes — pedido de Abba (Seba): objetivo general
// repartido a mano por persona, editable sobre la marcha. El "objetivo
// general" no se guarda aparte, es la suma de estas filas (ver schema.prisma,
// modelo SalesTarget).
export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER') && !(await roleHasModule(payload.orgId, payload.role, 'pipeline')))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const month = req.nextUrl.searchParams.get('month')
    if (!month || !MONTH_RE.test(month)) return NextResponse.json({ error: 'Mes inválido (YYYY-MM)' }, { status: 400 })

    const db = prisma as any
    const targets = await db.salesTarget.findMany({
      where: { organizationId: payload.orgId, month },
      select: { id: true, userId: true, amount: true, currency: true, user: { select: { id: true, name: true } } },
      orderBy: { amount: 'desc' },
    })

    return NextResponse.json({ data: targets })
  } catch (error) {
    console.error('[SALES TARGETS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST — alta/edición de UN objetivo (upsert por organización+usuario+mes+moneda).
// Sólo ADMIN+ reparte/ajusta objetivos — mismo piso que reasignar un deal.
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN'))
      return NextResponse.json({ error: 'Sólo un admin puede definir objetivos' }, { status: 403 })

    const { userId, month, amount, currency = 'USD' } = await req.json()
    if (!userId) return NextResponse.json({ error: 'Falta el usuario' }, { status: 400 })
    if (!month || !MONTH_RE.test(month)) return NextResponse.json({ error: 'Mes inválido (YYYY-MM)' }, { status: 400 })
    const amountNum = Number(amount)
    if (!Number.isFinite(amountNum) || amountNum < 0) return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })

    const db = prisma as any
    const user = await db.user.findFirst({ where: { id: userId, organizationId: payload.orgId }, select: { id: true } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado en esta organización' }, { status: 400 })

    if (amountNum === 0) {
      await db.salesTarget.deleteMany({ where: { organizationId: payload.orgId, userId, month, currency } })
      return NextResponse.json({ data: null })
    }

    const target = await db.salesTarget.upsert({
      where: { organizationId_userId_month_currency: { organizationId: payload.orgId, userId, month, currency } },
      create: { organizationId: payload.orgId, userId, month, currency, amount: amountNum },
      update: { amount: amountNum },
      select: { id: true, userId: true, amount: true, currency: true, user: { select: { id: true, name: true } } },
    })

    return NextResponse.json({ data: target })
  } catch (error) {
    console.error('[SALES TARGETS POST]', error)
    return NextResponse.json({ error: 'Error al guardar el objetivo' }, { status: 500 })
  }
}
