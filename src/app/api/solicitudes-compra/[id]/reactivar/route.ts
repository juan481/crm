import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { puedeVerCompras } from '@/lib/stock-access'
import { prisma } from '@/lib/db'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// POST /api/solicitudes-compra/[id]/reactivar — deshace un "Anular" (Abba,
// 19/11: "¿cómo levanto de nuevo este pedido?"). Anular un pedido no toca
// stock ni manda nada al proveedor, así que volver atrás es sólo recuperar
// el estado que tenía: no se reenvía el mail ni se le da un número nuevo.
//  - sin número  → nunca se envió   → BORRADOR
//  - todos los ítems con respuesta  → RESPONDIDA
//  - si no                          → ENVIADA
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const existing = await db.solicitudCompra.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: {
        id: true, estado: true, numero: true,
        _count: { select: { items: true } },
      },
    })
    if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    if (existing.estado !== 'ANULADA') return NextResponse.json({ error: 'El pedido no está anulado' }, { status: 409 })

    let estado = 'BORRADOR'
    if (existing.numero != null) {
      const pendientes = await db.solicitudCompraItem.count({
        where: { solicitudId: existing.id, disponible: null },
      })
      estado = existing._count.items > 0 && pendientes === 0 ? 'RESPONDIDA' : 'ENVIADA'
    }

    // updateMany con el estado en el where: si dos personas tocan el botón a
    // la vez, sólo una lo reactiva.
    const res = await db.solicitudCompra.updateMany({
      where: { id: existing.id, estado: 'ANULADA' },
      data: { estado },
    })
    if (res.count === 0) return NextResponse.json({ error: 'El pedido ya no está anulado' }, { status: 409 })

    const label = estado === 'BORRADOR' ? 'borrador' : estado === 'RESPONDIDA' ? 'respondido' : 'enviado'
    return NextResponse.json({ message: `Pedido reactivado (vuelve a ${label})`, data: { estado } })
  } catch (error) {
    console.error('[SOLICITUD COMPRA REACTIVAR]', error)
    return NextResponse.json({ error: 'Error al reactivar' }, { status: 500 })
  }
}
