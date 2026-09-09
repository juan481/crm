import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { puedeVerCompras } from '@/lib/stock-access'
import { registrarMovimiento } from '@/lib/stock'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// POST /api/compras/[id]/anular — CONFIRMADA → ANULADA. Revierte el stock que
// ingresó con movimientos de Salida compensatorios (origen AJUSTE). Falla si
// algún producto ya no tiene stock suficiente para revertir (la mercadería ya
// se usó/vendió) — en ese caso hay que ajustar a mano.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const compra = await db.compra.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true, estado: true, numero: true, numeroComprobante: true },
    })
    if (!compra) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    if (compra.estado === 'BORRADOR') return NextResponse.json({ error: 'Una compra en borrador se elimina, no se anula' }, { status: 409 })
    if (compra.estado === 'ANULADA') return NextResponse.json({ error: 'La compra ya está anulada' }, { status: 409 })

    // Movimientos de Entrada que generó esta compra.
    const entradas = await db.stockMovimiento.findMany({
      where: { organizationId: payload.orgId, compraId: compra.id, tipo: 'Entrada' },
      select: { productId: true, cantidad: true },
    })

    const result = await db.$transaction(async (tx: any) => {
      let revertidos = 0
      for (const e of entradas) {
        const res = await registrarMovimiento(tx, {
          productId: e.productId,
          organizationId: payload.orgId,
          tipo: 'Salida',
          cantidad: e.cantidad,
          origen: 'AJUSTE',
          motivo: `Anulación de compra ${compra.numero ?? compra.numeroComprobante ?? ''}`.trim(),
          creadoPorId: payload.userId,
          compraId: compra.id,
        })
        if (!res.ok) {
          throw Object.assign(
            new Error(`No se puede anular: un producto ya no tiene stock suficiente para revertir la entrada (${res.error}). Ajustá el stock a mano.`),
            { status: 409 },
          )
        }
        revertidos++
      }
      // Las alertas de costo pendientes de esta compra se descartan.
      await tx.alertaCosto.updateMany({
        where: { organizationId: payload.orgId, compraId: compra.id, estado: 'PENDIENTE' },
        data: { estado: 'DESCARTADA', revisadoPorId: payload.userId, revisadoEn: new Date() },
      })
      await tx.compra.update({ where: { id: compra.id }, data: { estado: 'ANULADA' } })
      return { revertidos }
    })

    return NextResponse.json({ data: result })
  } catch (error: any) {
    if (error?.status) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('[COMPRA ANULAR]', error)
    return NextResponse.json({ error: 'Error al anular la compra' }, { status: 500 })
  }
}
