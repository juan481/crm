import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

// "Utilidad real" — ver comentario en Organization.utilidadRealPct
// (schema.prisma). GET: cualquier usuario interno logueado (el panel de
// comisiones lo necesita para mostrar de dónde sale el número, no sólo
// ADMIN+). PATCH: sólo ADMIN+ la cambia.
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const org = await (prisma.organization as any).findUnique({
      where: { id: payload.orgId },
      select: { utilidadRealPct: true },
    })
    return NextResponse.json({ data: { utilidadRealPct: org?.utilidadRealPct ?? 0 } })
  } catch (error) {
    console.error('[ORGANIZATION/UTILIDAD-REAL GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN'))
      return NextResponse.json({ error: 'Sólo un admin puede cambiar esto' }, { status: 403 })

    const { utilidadRealPct } = await req.json()
    if (typeof utilidadRealPct !== 'number' || !Number.isFinite(utilidadRealPct) || utilidadRealPct < 0 || utilidadRealPct > 100) {
      return NextResponse.json({ error: 'Tiene que ser un número entre 0 y 100' }, { status: 400 })
    }

    await (prisma.organization as any).update({
      where: { id: payload.orgId },
      data: { utilidadRealPct },
    })
    return NextResponse.json({ data: { utilidadRealPct } })
  } catch (error) {
    console.error('[ORGANIZATION/UTILIDAD-REAL PATCH]', error)
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }
}
