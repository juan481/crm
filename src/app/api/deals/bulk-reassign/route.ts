import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

const MAX_IDS = 500

// Reasignar varias oportunidades de una — pedido de Abba (Seba, 22/10):
// "tengo que cambiar los de Emilio y tengo que buscarlos uno por uno". Mismo
// criterio que reasignar desde el detalle (PATCH /api/deals/[id]): sólo
// Admin+, y el usuario destino tiene que ser de la misma organización. Sólo
// cambia el responsable — ni etapa ni fechas.
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Solo admins pueden reasignar deals' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown): x is string => typeof x === 'string' && x.length > 0) : []
    const ownerId = typeof body?.ownerId === 'string' ? body.ownerId : ''
    if (ids.length === 0) return NextResponse.json({ error: 'No elegiste ninguna oportunidad' }, { status: 400 })
    if (ids.length > MAX_IDS) return NextResponse.json({ error: `Máximo ${MAX_IDS} oportunidades por vez` }, { status: 400 })
    if (!ownerId) return NextResponse.json({ error: 'Falta a quién reasignarlas' }, { status: 400 })

    const owner = await prisma.user.findFirst({
      where: { id: ownerId, organizationId: payload.orgId },
      select: { id: true, name: true },
    })
    if (!owner) return NextResponse.json({ error: 'Usuario no encontrado en esta organización' }, { status: 400 })

    const { count } = await prisma.deal.updateMany({
      where: { id: { in: ids }, organizationId: payload.orgId },
      data: { ownerId: owner.id },
    })

    return NextResponse.json({ ok: true, updated: count, owner })
  } catch (error) {
    console.error('[DEALS BULK-REASSIGN]', error)
    return NextResponse.json({ error: 'Error al reasignar' }, { status: 500 })
  }
}
