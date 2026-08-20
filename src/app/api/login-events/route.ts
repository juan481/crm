import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Mismo criterio de visibilidad que GET /api/asistencia: HR/ADMIN/SUPER_ADMIN
// pueden pedir el log de cualquier usuario de la org, el resto sólo el propio
// (ignora el ?userId= que le manden si no es el suyo).
export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const requestedUserId = searchParams.get('userId')
    const limit = Math.min(200, Number(searchParams.get('limit') ?? 50))

    const canSeeAll = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(payload.role)
    const userId = canSeeAll ? (requestedUserId || undefined) : payload.userId

    const db = prisma as any
    const events = await db.loginEvent.findMany({
      where: { organizationId: payload.orgId, ...(userId && { userId }) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, type: true, ipAddress: true, createdAt: true, user: { select: { id: true, name: true, avatarUrl: true } } },
    })

    return NextResponse.json({ data: events })
  } catch (error) {
    console.error('[LOGIN EVENTS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
