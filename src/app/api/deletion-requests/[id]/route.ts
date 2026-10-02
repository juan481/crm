import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST { action: 'approve' | 'reject' } — sólo SUPER_ADMIN (ver GET de acá
// arriba). "approve" ejecuta el delete real de la entidad recién acá, nunca
// antes — mientras el pedido está PENDING la entidad sigue intacta.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (payload.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { action } = await req.json()
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }

    const db = prisma as any
    const solicitud = await db.deletionRequest.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
    })
    if (!solicitud) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    if (solicitud.status !== 'PENDING') return NextResponse.json({ error: 'Este pedido ya fue resuelto' }, { status: 409 })

    if (action === 'approve') {
      // Si la entidad ya no existe (por ejemplo, se borró por otra vía o el
      // merge de duplicados se la llevó puesta) no rompe — se marca igual
      // como aprobado, no hay nada más que borrar.
      if (solicitud.entityType === 'empresa') {
        await db.empresa.deleteMany({ where: { id: solicitud.entityId, organizationId: payload.orgId } })
      } else if (solicitud.entityType === 'contacto') {
        await db.directorioContacto.deleteMany({ where: { id: solicitud.entityId, organizationId: payload.orgId } })
      }
    }

    const updated = await db.deletionRequest.update({
      where: { id: params.id },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        resolvedById: payload.userId,
        resolvedAt: new Date(),
      },
    })

    return NextResponse.json({
      message: action === 'approve' ? 'Baja confirmada — se eliminó.' : 'Pedido de baja rechazado.',
      data: { ...updated, createdAt: updated.createdAt.toISOString(), resolvedAt: updated.resolvedAt?.toISOString() ?? null },
    })
  } catch (error) {
    console.error('[DELETION REQUEST RESOLVE]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
