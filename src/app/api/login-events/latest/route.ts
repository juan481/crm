import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Un solo timestamp por usuario (su acceso más reciente, sea LOGIN o
// LOGOUT) — para mostrar "Última vez: hace X" en el roster de RRHH sin
// tener que entrar a cada ficha. El historial completo sigue viviendo en
// GET /api/login-events (por usuario, con el detalle LOGIN/LOGOUT).
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const canSeeAll = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(payload.role)
    const db = prisma as any

    const grouped = await db.loginEvent.groupBy({
      by: ['userId'],
      where: { organizationId: payload.orgId, ...(canSeeAll ? {} : { userId: payload.userId }) },
      _max: { createdAt: true },
    })

    const data = grouped.map((g: { userId: string; _max: { createdAt: Date | null } }) => ({
      userId: g.userId,
      lastSeenAt: g._max.createdAt,
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[LOGIN EVENTS LATEST]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
