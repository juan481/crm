import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/usuarios
// Returns internal CRM users (not clients) for dropdowns like ticket assignment.
// Accessible to any authenticated user (unlike /api/settings/users which is admin-only).
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const users = await prisma.user.findMany({
      where: {
        organizationId: payload.orgId,
        status: { not: 'DELETED' },
      },
      select: {
        id:        true,
        name:      true,
        role:      true,
        avatarUrl: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ data: users })
  } catch (error) {
    console.error('[USUARIOS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
