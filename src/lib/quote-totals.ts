// Cálculo de totales de una cotización, con IVA discriminado. Único lugar
// donde vive esta matemática — lo usan el cotizador (preview + PDF + texto de
// WhatsApp), la ruta que guarda la cotización (recálculo autoritativo
// server-side), y las vistas de detalle/listado.
//
// Los precios del catálogo son NETOS (sin IVA) — ver el comentario de
// Product.price en schema.prisma. El IVA se suma acá.

// Alícuotas de IVA válidas en Argentina. Cualquier otro valor (ej. 22, que
// aparece por un typo en la planilla del proveedor) o null/blank cae a
// DEFAULT_IVA_PCT.
export const VALID_IVA_RATES = [0, 2.5, 5, 10.5, 21, 27] as const
export const DEFAULT_IVA_PCT = 21

export function sanitizeIvaPct(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
  return (VALID_IVA_RATES as readonly number[]).includes(n) ? n : DEFAULT_IVA_PCT
}

export interface QuoteLine {
  price: number       // precio NETO unitario
  quantity: number
  ivaPct?: number | null // si falta, se usa DEFAULT_IVA_PCT
  type?: string       // 'SERVICE' | 'PRODUCT' — informativo
}

export interface IvaBucket {
  pct: number         // alícuota (21, 10.5, …)
  base: number        // neto gravado a esta alícuota (ya con el descuento aplicado)
  monto: number       // IVA = base * pct/100
}

export interface QuoteTotals {
  neto: number            // Σ price·qty, sin descuento, sin IVA
  descuentoPct: number
  descuentoMonto: number
  netoGravado: number     // neto − descuento
  discriminado: boolean
  iva: IvaBucket[]        // buckets con monto > 0, ordenados por alícuota desc
  ivaTotal: number
  total: number           // netoGravado + ivaTotal  (si !discriminado, == netoGravado)
}

/**
 * @param lines  ítems de la cotización (precio neto)
 * @param discountPct  0–100
 * @param discriminado  si false, el IVA no se calcula ni se suma (total = neto − descuento)
 */
export function computeQuoteTotals(
  lines: QuoteLine[],
  discountPct: number,
  discriminado: boolean,
): QuoteTotals {
  const disc = Math.max(0, Math.min(100, Number(discountPct) || 0))
  const factor = 1 - disc / 100

  let neto = 0
  const byRate = new Map<number, number>() // alícuota -> neto (sin descuento) a esa alícuota

  for (const l of lines) {
    const lineNet = (Number(l.price) || 0) * (Number(l.quantity) || 0)
    neto += lineNet
    const rate = l.ivaPct == null ? DEFAULT_IVA_PCT : sanitizeIvaPct(l.ivaPct)
    byRate.set(rate, (byRate.get(rate) ?? 0) + lineNet)
  }

  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
  neto = round2(neto)
  const descuentoMonto = round2(neto * (disc / 100))
  const netoGravado = round2(neto - descuentoMonto)

  const iva: IvaBucket[] = []
  if (discriminado) {
    for (const [pct, baseSinDesc] of Array.from(byRate.entries())) {
      if (pct <= 0) continue
      const base = round2(baseSinDesc * factor)
      const monto = round2(base * (pct / 100))
      if (monto > 0) iva.push({ pct, base, monto })
    }
    iva.sort((a, b) => b.pct - a.pct)
  }

  const ivaTotal = round2(iva.reduce((s, b) => s + b.monto, 0))
  const total = round2(netoGravado + ivaTotal)

  return { neto, descuentoPct: disc, descuentoMonto, netoGravado, discriminado, iva, ivaTotal, total }
}
