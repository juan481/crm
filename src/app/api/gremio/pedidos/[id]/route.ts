import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

export async function GET(_req: Request, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (payload.role !== 'GREMIO') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    // Scopeado a userId además de organizationId — un usuario Gremio nunca
    // ve el detalle de un pedido ajeno, ni siquiera de la misma org.
    const pedido = await db.pedido.findFirst({
      where: { id: params.id, organizationId: payload.orgId, userId: payload.userId },
      include: { items: true },
    })
    if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

    return NextResponse.json({ data: pedido })
  } catch (error) {
    console.error('[GREMIO PEDIDO GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
