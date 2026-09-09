import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { puedeVerStock } from '@/lib/stock-access'
import { registrarMovimiento } from '@/lib/stock'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

interface ItemConteo {
  productId: string
  cantidad: number       // stock CONTADO (absoluto), no un delta
  stockMinimo?: number | null
}

// POST /api/stock/conteo-inicial — carga masiva de stock físico.
// Para cada ítem se compara la cantidad contada contra el stock actual y se
// registra el movimiento que lleva de uno al otro (Entrada si sube, Ajuste
// si baja), con origen 'INICIAL'. Si el producto todavía no trackea stock,
// se lo marca `trackStock: true`. Todo en una sola transacción.
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerStock(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const items: ItemConteo[] = Array.isArray(body?.items) ? body.items : []
    if (items.length === 0) return NextResponse.json({ error: 'No hay ítems para cargar' }, { status: 400 })
    if (items.length > 500) return NextResponse.json({ error: 'Máximo 500 ítems por carga' }, { status: 400 })

    const db = prisma as any

    // Validar que todos los productos son de esta org.
    const ids = Array.from(new Set(items.map((i) => i.productId).filter(Boolean)))
    const productos = await db.product.findMany({
      where: { id: { in: ids }, organizationId: payload.orgId },
      select: { id: true, stock: true },
    })
    const stockActual = new Map<string, number>(productos.map((p: any) => [p.id, p.stock]))

    const resultado = await db.$transaction(async (tx: any) => {
      const aplicados: { productId: string; movimientoId: string; delta: number }[] = []
      const saltados: { productId: string; motivo: string }[] = []

      for (const it of items) {
        const actual = stockActual.get(it.productId)
        if (actual === undefined) { saltados.push({ productId: it.productId, motivo: 'Producto no encontrado' }); continue }

        const contado = Math.round(Number(it.cantidad))
        if (!Number.isFinite(contado) || contado < 0) { saltados.push({ productId: it.productId, motivo: 'Cantidad inválida' }); continue }

        // Marcar trackStock + mínimo (si vino) antes del movimiento.
        const patch: Record<string, unknown> = { trackStock: true }
        if (it.stockMinimo !== undefined) {
          const min = it.stockMinimo === null ? null : Math.round(Number(it.stockMinimo))
          patch.stockMinimo = min != null && Number.isFinite(min) && min >= 0 ? min : null
        }
        await tx.product.update({ where: { id: it.productId }, data: patch })

        const delta = contado - actual
        if (delta === 0) { saltados.push({ productId: it.productId, motivo: 'Sin cambios' }); continue }

        const res = await registrarMovimiento(tx, {
          productId: it.productId,
          organizationId: payload.orgId,
          tipo: delta > 0 ? 'Entrada' : 'Ajuste',
          cantidad: Math.abs(delta),
          signoAjuste: delta < 0 ? -1 : undefined,
          origen: 'INICIAL',
          motivo: 'Conteo inicial de depósito',
          creadoPorId: payload.userId,
        })
        if (!res.ok) throw new Error(`${it.productId}: ${res.error}`)
        aplicados.push({ productId: it.productId, movimientoId: res.movimientoId, delta })
      }

      return { aplicados, saltados }
    })

    return NextResponse.json({
      data: {
        aplicados: resultado.aplicados.length,
        saltados: resultado.saltados.length,
        detalleSaltados: resultado.saltados,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[STOCK CONTEO-INICIAL POST]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 })
  }
}
