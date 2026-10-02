import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Sólo SUPER_ADMIN — es quien resuelve los pedidos (ver requestOrDelete en
// src/lib/deletion-requests.ts). Un ADMIN puede CREAR un pedido pero no
// necesita ver la cola entera de la organización.
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (payload.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const data = await prisma.deletionRequest.findMany({
      where: { organizationId: payload.orgId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, entityType: true, entityId: true, entityLabel: true, createdAt: true,
        requestedBy: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({
      data: data.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    })
  } catch (error) {
    console.error('[DELETION REQUESTS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
