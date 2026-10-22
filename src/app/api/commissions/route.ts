import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import { prisma } from '@/lib/db'
import { commissionTierPct } from '@/lib/commissions'
import { argentinaMonthRange } from '@/lib/timezone'

export const dynamic = 'force-dynamic'

const MONTH_RE = /^\d{4}-\d{2}$/
// Mismo roster que ObjetivosPanel (src/components/pipeline/objetivos-panel.tsx)
// — quien puede tener un objetivo de venta puede tener comisión.
const ROLES_VENTA = ['SUPER_ADMIN', 'ADMIN', 'ADMINISTRATIVO', 'SELLER', 'TECHNICIAN']

interface CommissionBreakdown {
  currency: string
  ganancia: number
  utilidad: number
  comision: number
}

interface UserCommission {
  userId: string
  name: string
  realVendido: number
  objetivo: number
  pctObjetivo: number
  tierPct: number
  breakdown: CommissionBreakdown[]
}

async function computeForUser(db: any, orgId: string, userId: string, month: string): Promise<Omit<UserCommission, 'name'>> {
  // Argentina-aware, no el constructor local de Date — en Vercel (UTC) eso
  // corría los límites del mes 3hs, pudiendo contar una venta cerrada cerca
  // de medianoche Argentina de fin de mes en el mes equivocado (bug real
  // encontrado en code-review — ver src/lib/timezone.ts).
  const { start, end } = argentinaMonthRange(month)

  const [ledgerGroups, dealSum, target] = await Promise.all([
    // Agrupado por moneda — una factura de cotización sale en ARS, un cobro
    // online puede ser USD; sumarlas juntas mezclaría montos incompatibles
    // (bug encontrado en code-review).
    db.commissionLedger.groupBy({
      by: ['currency'],
      where: { organizationId: orgId, userId, month },
      _sum: { ganancia: true, utilidad: true },
    }),
    db.deal.aggregate({
      where: { organizationId: orgId, ownerId: userId, stage: 'GANADO', closedAt: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    // currency: 'USD' explícito — es la única moneda que la UI de Objetivos
    // llega a guardar hoy (ver saveTarget en objetivos-panel.tsx), pero el
    // modelo permite más de una fila por mes (unique incluye currency);
    // sin este filtro, cuál se lee quedaba sin definir.
    db.salesTarget.findFirst({ where: { organizationId: orgId, userId, month, currency: 'USD' }, select: { amount: true } }),
  ])

  const realVendido = dealSum._sum.amount ?? 0
  const objetivo = target?.amount ?? 0
  const pctObjetivo = objetivo > 0 ? Math.round((realVendido / objetivo) * 10000) / 100 : 0
  const tierPct = commissionTierPct(pctObjetivo)
  const breakdown: CommissionBreakdown[] = ledgerGroups.map((g: any) => {
    const utilidad = g._sum.utilidad ?? 0
    return {
      currency: g.currency,
      ganancia: g._sum.ganancia ?? 0,
      utilidad,
      comision: Math.round((utilidad * (tierPct / 100) + Number.EPSILON) * 100) / 100,
    }
  })

  return { userId, realVendido, objetivo, pctObjetivo, tierPct, breakdown }
}

// GET /api/commissions?month=YYYY-MM[&all=1][&userId=]
// Sin `all`/`userId`: la comisión de quien pide. `all=1` (ADMIN+): la de
// todo el equipo de venta, para el panel. `userId=` (ADMIN+): la de uno en
// particular (ej. para que un admin revise sin traer a todo el equipo).
export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER') && !(await roleHasModule(payload.orgId, payload.role, 'pipeline')))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const month = req.nextUrl.searchParams.get('month')
    if (!month || !MONTH_RE.test(month)) return NextResponse.json({ error: 'Mes inválido (YYYY-MM)' }, { status: 400 })

    const db = prisma as any
    const isAdmin = canAccess(payload.role, 'ADMIN')
    const wantsAll = req.nextUrl.searchParams.get('all') === '1'
    const requestedUserId = req.nextUrl.searchParams.get('userId')

    if (wantsAll) {
      if (!isAdmin) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
      const users = await db.user.findMany({
        where: { organizationId: payload.orgId, role: { in: ROLES_VENTA }, status: 'ACTIVE' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
      const data: UserCommission[] = await Promise.all(
        users.map(async (u: { id: string; name: string }) => ({ name: u.name, ...(await computeForUser(db, payload.orgId, u.id, month)) })),
      )
      return NextResponse.json({ data })
    }

    const targetUserId = (isAdmin && requestedUserId) ? requestedUserId : payload.userId
    const user = await db.user.findFirst({ where: { id: targetUserId, organizationId: payload.orgId }, select: { id: true, name: true } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const result: UserCommission = { name: user.name, ...(await computeForUser(db, payload.orgId, user.id, month)) }
    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('[COMMISSIONS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
