import { registrarMovimiento } from '@/lib/stock'

// Umbral para crear una AlertaCosto — abs(Δ) > 1 centavo Y variación >= minPct
// (default 0,5%). Filtra ruido de redondeo sin dejar pasar un cambio real.
// `nuevo` <= 0 no cuenta: un costo en 0 casi siempre es una celda vacía / un
// dato que no se leyó, no "el producto ahora es gratis".
export function esCambioDeCostoRelevante(
  anterior: number | null | undefined,
  nuevo: number | null | undefined,
  minPct = 0.005,
): boolean {
  if (anterior == null || anterior <= 0 || nuevo == null || nuevo <= 0) return false
  if (Math.abs(nuevo - anterior) <= 0.01) return false
  return Math.abs((nuevo - anterior) / anterior) >= minPct
}

// Variación tan grande que es casi seguro un error de carga o una mezcla de
// monedas (USD vs ARS) en la planilla del proveedor, no un cambio de precio
// real. Se sigue avisando, pero marcado como sospechoso y sin auto-aplicar.
export function esVariacionAbsurda(anterior: number, nuevo: number): boolean {
  if (!anterior || anterior <= 0) return false
  return Math.abs((nuevo - anterior) / anterior) >= 5 // ±500%
}

export function variacionPct(anterior: number, nuevo: number): number {
  if (!anterior) return 0
  return Math.round(((nuevo - anterior) / anterior) * 1000) / 10
}

export interface ItemCompraInput {
  productId?: string | null
  sku?: string | null
  nombre: string
  cantidad: number
  costoUnitario: number
}

export interface CrearCompraInput {
  organizationId: string
  creadoPorId: string
  proveedorId?: string | null
  numeroComprobante?: string | null
  tipoComprobante?: string | null
  fecha?: string | null
  moneda?: string | null
  subtotal?: number | null
  iva?: number | null
  total?: number | null
  dealId?: string | null
  documentoId?: string | null
  vencimiento?: string | null
  notas?: string | null
  ocrRaw?: unknown
  items: ItemCompraInput[]
}

function n(v: unknown, def = 0): number {
  const x = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN
  return Number.isFinite(x) ? x : def
}

// Crea una Compra en BORRADOR con sus ítems. tx = cliente Prisma o transacción.
export async function crearCompra(tx: any, input: CrearCompraInput): Promise<{ id: string }> {
  const items = (input.items ?? []).filter((it) => it.nombre?.trim())
  const subtotalItems = items.reduce((s, it) => s + n(it.costoUnitario) * n(it.cantidad, 1), 0)

  const compra = await tx.compra.create({
    data: {
      organizationId: input.organizationId,
      creadoPorId: input.creadoPorId,
      proveedorId: input.proveedorId || null,
      numeroComprobante: input.numeroComprobante?.trim() || null,
      tipoComprobante: input.tipoComprobante?.trim() || null,
      fecha: input.fecha && !isNaN(Date.parse(input.fecha)) ? new Date(input.fecha) : new Date(),
      moneda: (input.moneda || 'ARS').toUpperCase(),
      subtotal: input.subtotal != null ? n(input.subtotal) : subtotalItems,
      iva: n(input.iva),
      total: input.total != null ? n(input.total) : subtotalItems + n(input.iva),
      dealId: input.dealId || null,
      documentoId: input.documentoId || null,
      vencimiento: input.vencimiento && !isNaN(Date.parse(input.vencimiento)) ? new Date(input.vencimiento) : null,
      notas: input.notas?.trim() || null,
      ocrRaw: input.ocrRaw ?? undefined,
      estado: 'BORRADOR',
      items: {
        create: items.map((it) => ({
          productId: it.productId || null,
          sku: it.sku?.trim() || null,
          nombre: it.nombre.trim(),
          cantidad: Math.max(1, Math.round(n(it.cantidad, 1))),
          costoUnitario: n(it.costoUnitario),
          subtotal: n(it.costoUnitario) * Math.max(1, Math.round(n(it.cantidad, 1))),
        })),
      },
    },
    select: { id: true },
  })
  return compra
}

export interface ConfirmarCompraResult {
  ok: true
  numero: number
  movimientos: number
  alertas: number
}
export interface ConfirmarCompraError {
  ok: false
  error: string
  status: number
}

// BORRADOR → CONFIRMADA dentro de una transacción:
//  - asigna número correlativo por org
//  - por cada ítem con producto trackeado: StockMovimiento Entrada (origen COMPRA)
//  - por cada ítem con cambio de costo relevante vs Product.costo: AlertaCosto
//    (dedupe: no crea otra si ya hay una PENDIENTE para ese producto)
// NO toca Product.costo — eso lo decide un ADMIN desde /stock → Alertas.
export async function confirmarCompra(
  tx: any,
  compraId: string,
  orgId: string,
  userId: string,
): Promise<ConfirmarCompraResult | ConfirmarCompraError> {
  const compra = await tx.compra.findFirst({
    where: { id: compraId, organizationId: orgId },
    include: { items: true },
  })
  if (!compra) return { ok: false, error: 'Compra no encontrada', status: 404 }
  if (compra.estado === 'CONFIRMADA') return { ok: false, error: 'La compra ya está confirmada', status: 409 }
  if (compra.estado === 'ANULADA') return { ok: false, error: 'La compra está anulada', status: 409 }

  const last = await tx.compra.findFirst({
    where: { organizationId: orgId, numero: { not: null } },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  })
  const numero = (last?.numero ?? 0) + 1

  let movimientos = 0
  let alertas = 0

  // Productos referenciados — para leer costo/moneda/trackStock actuales.
  const productIds = Array.from(new Set(compra.items.map((i: any) => i.productId).filter(Boolean))) as string[]
  const productos = productIds.length
    ? await tx.product.findMany({ where: { id: { in: productIds }, organizationId: orgId }, select: { id: true, costo: true, currency: true, price: true, precioGremio: true, trackStock: true } })
    : []
  const prodById = new Map<string, any>(productos.map((p: any) => [p.id, p]))
  const monedaCompra = (compra.moneda || 'ARS').toUpperCase()

  for (const it of compra.items) {
    if (!it.productId) continue
    const prod: any = prodById.get(it.productId)
    if (!prod) continue

    if (prod.trackStock) {
      const res = await registrarMovimiento(tx, {
        productId: it.productId,
        organizationId: orgId,
        tipo: 'Entrada',
        cantidad: it.cantidad,
        origen: 'COMPRA',
        motivo: `Compra${compra.numeroComprobante ? ` ${compra.numeroComprobante}` : ''}`,
        creadoPorId: userId,
        compraId: compra.id,
        dealId: compra.dealId,
        numeroComprobante: compra.numeroComprobante,
        costoUnitario: it.costoUnitario,
      })
      if (!res.ok) return { ok: false, error: `${it.nombre}: ${res.error}`, status: res.status }
      movimientos++
    }

    // Snapshot del costo anterior en el ítem + alerta si cambió.
    const costoAnterior = prod.costo as number | null
    await tx.compraItem.update({ where: { id: it.id }, data: { costoAnterior } })

    // Sólo se compara si el costo guardado está en la MISMA moneda que la
    // factura — comparar USD 16 contra ARS 25.000 da "subió 156.000%", que
    // es ruido, no una alerta útil.
    const monedaProd = (prod.currency || 'USD').toUpperCase()
    const mismaMoneda = monedaProd === monedaCompra

    if (mismaMoneda && esCambioDeCostoRelevante(costoAnterior, it.costoUnitario)) {
      const yaHay = await tx.alertaCosto.findFirst({
        where: { organizationId: orgId, productId: it.productId, estado: 'PENDIENTE' },
        select: { id: true },
      })
      if (!yaHay) {
        const raro = esVariacionAbsurda(costoAnterior as number, it.costoUnitario)
        await tx.alertaCosto.create({
          data: {
            organizationId: orgId,
            productId: it.productId,
            costoAnterior: costoAnterior as number,
            costoNuevo: it.costoUnitario,
            variacionPct: variacionPct(costoAnterior as number, it.costoUnitario),
            origen: 'COMPRA',
            nota: raro ? 'Variación muy grande — revisá que la factura y el costo del catálogo estén en la misma moneda antes de aplicar.' : null,
            compraId: compra.id,
          },
        })
        alertas++
      }
    }
  }

  await tx.compra.update({
    where: { id: compra.id },
    data: { estado: 'CONFIRMADA', numero },
  })

  return { ok: true, numero, movimientos, alertas }
}
