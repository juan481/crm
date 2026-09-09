// Lista curada de tipos de movimiento de stock — string en vez de enum de
// Prisma, mismo criterio que ETIQUETAS_TURNO (src/lib/asistencia-turnos.ts)
// y CONDICIONES_IVA (src/lib/fiscal.ts): un admin puede necesitar ajustar
// esta lista sin pedir una migración.
export const TIPOS_MOVIMIENTO_STOCK = ['Entrada', 'Salida', 'Ajuste'] as const
export type TipoMovimientoStock = (typeof TIPOS_MOVIMIENTO_STOCK)[number]

export function isValidTipoMovimiento(v: unknown): v is TipoMovimientoStock {
  return typeof v === 'string' && (TIPOS_MOVIMIENTO_STOCK as readonly string[]).includes(v)
}

// Origen del movimiento — de qué parte del sistema salió.
export const ORIGENES_MOVIMIENTO = ['MANUAL', 'INICIAL', 'COMPRA', 'VENTA', 'AJUSTE'] as const
export type OrigenMovimiento = (typeof ORIGENES_MOVIMIENTO)[number]

// 'Salida' y 'Ajuste' negativo restan del stock actual; 'Entrada' y 'Ajuste'
// positivo suman. El signo real de un 'Ajuste' lo decide quien carga el
// movimiento (puede ser para corregir un conteo hacia arriba o hacia abajo)
// — por eso Ajuste acepta un signo explícito en vez de asumir uno solo.
export function nextStock(current: number, tipo: TipoMovimientoStock, cantidad: number, signoAjuste?: 1 | -1): number {
  if (tipo === 'Entrada') return current + cantidad
  if (tipo === 'Salida') return current - cantidad
  return current + cantidad * (signoAjuste ?? 1)
}

// Delta con signo a partir del tipo + signo del ajuste.
export function deltaStock(tipo: TipoMovimientoStock, cantidad: number, signoAjuste?: 1 | -1): number {
  return tipo === 'Entrada' ? cantidad : tipo === 'Salida' ? -cantidad : cantidad * (signoAjuste ?? 1)
}

export interface RegistrarMovimientoInput {
  productId: string
  organizationId: string
  tipo: TipoMovimientoStock
  cantidad: number        // siempre > 0
  signoAjuste?: 1 | -1    // sólo para tipo 'Ajuste'
  origen?: OrigenMovimiento
  motivo?: string | null
  creadoPorId?: string | null
  compraId?: string | null
  entregaId?: string | null
  dealId?: string | null
  numeroComprobante?: string | null
  costoUnitario?: number | null
}

export interface RegistrarMovimientoOk {
  ok: true
  stockResultante: number
  movimientoId: string
}
export interface RegistrarMovimientoErr {
  ok: false
  error: string
  status: number
}

/**
 * Aplica un movimiento de stock de forma atómica y deja la fila en el ledger.
 * `tx` es un cliente de transacción Prisma (o `prisma` directo — pero para
 * varios movimientos en una operación, pasar la misma tx).
 *
 * Usa el mismo UPDATE condicionado (`WHERE stock + delta >= 0`) que ya estaba
 * inline en POST /api/products/[id]/stock — así dos movimientos simultáneos
 * sobre el mismo producto se serializan por el lock de fila y ninguno pisa al
 * otro. Devuelve un error tipado (no tira) si el producto no existe o el stock
 * quedaría negativo, para que el llamador decida qué hacer con el lote.
 */
export async function registrarMovimiento(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  input: RegistrarMovimientoInput,
): Promise<RegistrarMovimientoOk | RegistrarMovimientoErr> {
  const cantidad = Math.round(Number(input.cantidad))
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { ok: false, error: 'La cantidad debe ser un número mayor a 0', status: 400 }
  }
  const delta = deltaStock(input.tipo, cantidad, input.signoAjuste)

  const rows: { stock: number }[] = await tx.$queryRaw`
    UPDATE "Product"
    SET stock = stock + ${delta}
    WHERE id = ${input.productId} AND "organizationId" = ${input.organizationId} AND stock + ${delta} >= 0
    RETURNING stock
  `
  if (rows.length === 0) {
    const existing = await tx.product.findFirst({
      where: { id: input.productId, organizationId: input.organizationId },
      select: { stock: true },
    })
    if (!existing) return { ok: false, error: 'Producto no encontrado', status: 404 }
    return {
      ok: false,
      error: `No hay stock suficiente — quedarían ${existing.stock + delta} unidades. Stock actual: ${existing.stock}.`,
      status: 400,
    }
  }

  const stockResultante = rows[0].stock
  const mov = await tx.stockMovimiento.create({
    data: {
      productId: input.productId,
      organizationId: input.organizationId,
      tipo: input.tipo,
      cantidad,
      stockResultante,
      origen: input.origen ?? 'MANUAL',
      motivo: input.motivo ?? null,
      creadoPorId: input.creadoPorId ?? null,
      compraId: input.compraId ?? null,
      entregaId: input.entregaId ?? null,
      dealId: input.dealId ?? null,
      numeroComprobante: input.numeroComprobante ?? null,
      costoUnitario: input.costoUnitario ?? null,
    },
    select: { id: true },
  })

  return { ok: true, stockResultante, movimientoId: mov.id }
}

// Extrae un número de stock del texto libre de "Disponibilidad/Stock" del
// Sheet del proveedor. "12" -> 12, "12 unidades" -> 12, "Disponible" -> null,
// "Sin stock" -> 0, "Consultar" -> null.
export function parseSupplierStock(texto: string | null | undefined): number | null {
  const t = (texto ?? '').trim().toLowerCase()
  if (!t) return null
  if (/sin stock|no hay|agotado/.test(t)) return 0
  const m = t.match(/-?\d+/)
  if (m) {
    const n = parseInt(m[0], 10)
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  return null
}
