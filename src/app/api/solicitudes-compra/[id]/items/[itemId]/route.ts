import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { puedeVerCompras } from '@/lib/stock-access'
import { prisma } from '@/lib/db'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// Dos usos distintos del mismo endpoint, según el estado del pedido:
//  - BORRADOR: editar cantidad/costoUnitario (todavía armando el pedido).
//  - ENVIADA/RESPONDIDA: marcar `disponible` true/false — es la respuesta
//    del importador, registrada a mano (no hay integración automática,
//    pedido explícito de Abba: la prioridad es código+costo+mercadería,
//    no gestionar plazos).
export async function PATCH(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const item = await db.solicitudCompraItem.findFirst({
      where: { id: params.itemId, solicitudId: params.id, solicitud: { organizationId: payload.orgId } },
      select: { id: true, solicitud: { select: { estado: true } } },
    })
    if (!item) return NextResponse.json({ error: 'Ítem no encontrado' }, { status: 404 })

    const body = await req.json()
    const data: Record<string, unknown> = {}

    if (body.cantidad !== undefined || body.costoUnitario !== undefined) {
      if (item.solicitud.estado !== 'BORRADOR') {
        return NextResponse.json({ error: 'Ya se envió — la cantidad y el costo no se pueden tocar' }, { status: 409 })
      }
      if (body.cantidad !== undefined) {
        const cantidad = Math.max(1, Math.round(Number(body.cantidad) || 1))
        data.cantidad = cantidad
      }
      if (body.costoUnitario !== undefined) {
        const costo = Number(body.costoUnitario)
        if (!Number.isFinite(costo) || costo < 0) return NextResponse.json({ error: 'El costo no es válido' }, { status: 400 })
        data.costoUnitario = costo
      }
    }

    if (body.disponible !== undefined) {
      if (item.solicitud.estado === 'BORRADOR') {
        return NextResponse.json({ error: 'Todavía no se envió — no hay respuesta del importador que registrar' }, { status: 409 })
      }
      data.disponible = body.disponible === null ? null : body.disponible === true
      data.resueltoPorId = payload.userId
      data.resueltoAt = new Date()
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })

    const updated = await db.solicitudCompraItem.update({
      where: { id: params.itemId },
      data,
      select: {
        id: true, productId: true, sku: true, nombre: true, cantidad: true,
        costoUnitario: true, moneda: true, disponible: true, resueltoAt: true,
      },
    })

    // Si ya todos los ítems tienen respuesta, la solicitud pasa de ENVIADA a
    // RESPONDIDA sola — así la lista refleja de un vistazo que no queda
    // nada pendiente de este pedido.
    if (body.disponible !== undefined) {
      const pendientes = await db.solicitudCompraItem.count({
        where: { solicitudId: params.id, disponible: null },
      })
      if (pendientes === 0) {
        await db.solicitudCompra.updateMany({
          where: { id: params.id, estado: 'ENVIADA' },
          data: { estado: 'RESPONDIDA' },
        })
      }
    }

    return NextResponse.json({
      data: { ...updated, resueltoAt: updated.resueltoAt?.toISOString() ?? null },
    })
  } catch (error) {
    console.error('[SOLICITUD COMPRA ITEM PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar el ítem' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const item = await db.solicitudCompraItem.findFirst({
      where: { id: params.itemId, solicitudId: params.id, solicitud: { organizationId: payload.orgId } },
      select: { id: true, solicitud: { select: { estado: true } } },
    })
    if (!item) return NextResponse.json({ error: 'Ítem no encontrado' }, { status: 404 })
    if (item.solicitud.estado !== 'BORRADOR') {
      return NextResponse.json({ error: 'Ya se envió — no se pueden quitar ítems' }, { status: 409 })
    }

    await db.solicitudCompraItem.delete({ where: { id: params.itemId } })
    return NextResponse.json({ message: 'Ítem quitado' })
  } catch (error) {
    console.error('[SOLICITUD COMPRA ITEM DELETE]', error)
    return NextResponse.json({ error: 'Error al quitar el ítem' }, { status: 500 })
  }
}
