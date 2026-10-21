// Cálculo de totales de una cotización, con IVA discriminado. Único lugar
// donde vive esta matemática — lo usan el cotizador (preview + PDF + texto de
// WhatsApp), la ruta que guarda la cotización (recálculo autoritativo
// server-side), y las vistas de detalle/listado.
//
// Los precios del catálogo son NETOS (sin IVA) — ver el comentario de
// Product.price en schema.prisma. El IVA se suma acá.

// La fuente de verdad de la alícuota es el Excel/Sheet del proveedor
// (Product.ivaPct) — el sistema NO tiene una lista cerrada de "alícuotas
// válidas" (hoy son 21% y 10,5%, pero si mañana cargan un producto al 8%,
// al 27%, o a lo que sea, se respeta tal cual). Sólo se cae a
// DEFAULT_IVA_PCT cuando el dato falta (null/blank) o es imposible como
// porcentaje (negativo, no numérico, o > 100 — típicamente un error de
// tipeo como "210" en vez de "21,0").
export const DEFAULT_IVA_PCT = 21
const MIN_SANE_IVA_PCT = 0
const MAX_SANE_IVA_PCT = 100

export function sanitizeIvaPct(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
  if (!Number.isFinite(n) || n < MIN_SANE_IVA_PCT || n > MAX_SANE_IVA_PCT) return DEFAULT_IVA_PCT
  return n
}

// Label de la línea de recargo/descuento por medio de pago — centralizado
// para que PDF/mail/WhatsApp/preview no repitan (y eventualmente diverjan
// en) la misma condición de signo en 5 lugares distintos.
export function medioPagoLabel(pct: number): string {
  return pct > 0 ? `Recargo tarjeta (+${pct}%)` : `Descuento efectivo (${pct}%)`
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
  neto: number            // Σ price·qty, sin descuento, sin IVA, sin ajuste de medio de pago
  medioPagoPct: number    // recargo (+) o descuento (−) por medio de pago, ej. +25 / −20
  medioPagoMonto: number  // neto * medioPagoPct/100 — línea de desglose propia, igual criterio que descuentoMonto
  descuentoPct: number
  descuentoMonto: number  // calculado sobre (neto + medioPagoMonto), no sobre neto puro — ver nota abajo
  netoGravado: number     // (neto + medioPagoMonto) − descuentoMonto
  discriminado: boolean
  iva: IvaBucket[]        // buckets con monto > 0, ordenados por alícuota desc
  ivaTotal: number
  total: number           // netoGravado + ivaTotal  (si !discriminado, == netoGravado)
}

/**
 * @param lines  ítems de la cotización (precio neto)
 * @param discountPct  0–100
 * @param discriminado  si false, el IVA no se calcula ni se suma (total = neto − descuento)
 * @param medioPagoPct  recargo (+) o descuento (−) por medio de pago elegido (ej. +25 tarjeta,
 *   −20 efectivo — ver Organization.recargoTarjetaPct/descuentoEfectivoPct). Default 0 = sin
 *   ajuste, el mismo comportamiento de siempre para cualquier llamado que no lo pase. A
 *   propósito NO se mezcla dentro de `neto` (ver bug encontrado en code-review: un `neto`
 *   "ajustado" no cuadraba con la suma de los ítems impresos en PDF/mail/WhatsApp) — se expone
 *   como `medioPagoMonto`, una línea de desglose más, mismo trato que `descuentoMonto`. Quien
 *   renderiza el desglose (PDF, mail, WhatsApp, preview) tiene que sumar esa línea igual que ya
 *   suma el descuento — ninguno de los dos se "esconde" dentro de `neto`.
 *
 *   El descuento comercial se aplica DESPUÉS del ajuste de medio de pago (sobre
 *   `neto + medioPagoMonto`, no sobre `neto` puro) — a propósito, no por elección arbitraria:
 *   es la única forma de que `netoGravado`/`total` coincidan con la suma real de las bases por
 *   alícuota de IVA (cada bucket ya se escala por `cardFactor * factor`, multiplicativo). Sumar
 *   los dos ajustes como montos independientes sobre el mismo `neto` (lo que hacía la primera
 *   versión de este fix) deja un cross-term suelto apenas los dos % son distintos de cero —
 *   bug real encontrado en code-review, no una sutileza cosmética: habría cobrado de más/menos.
 */
export function computeQuoteTotals(
  lines: QuoteLine[],
  discountPct: number,
  discriminado: boolean,
  medioPagoPct: number = 0,
): QuoteTotals {
  const disc = Math.max(0, Math.min(100, Number(discountPct) || 0))
  const factor = 1 - disc / 100
  // Piso en -100 (no en +100 — un recargo de tarjeta no tiene por qué tener
  // techo): por debajo de -100, cardFactor se vuelve negativo y arrastra
  // netoGravado/IVA/total a números sin sentido en silencio (encontrado en
  // code-review) — ej. un descuentoEfectivoPct mal cargado a 150 en vez de
  // 15. No debería pasar nunca con los valores reales de Abba (20/25), pero
  // es la única validación real ya que no hay UI de settings todavía.
  const medioPago = Math.max(-100, Number(medioPagoPct) || 0)
  const cardFactor = 1 + medioPago / 100

  let neto = 0
  const byRate = new Map<number, number>() // alícuota -> neto (sin descuento, sin ajuste de medio de pago) a esa alícuota

  for (const l of lines) {
    const lineNet = (Number(l.price) || 0) * (Number(l.quantity) || 0)
    neto += lineNet
    const rate = l.ivaPct == null ? DEFAULT_IVA_PCT : sanitizeIvaPct(l.ivaPct)
    byRate.set(rate, (byRate.get(rate) ?? 0) + lineNet)
  }

  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
  neto = round2(neto)
  const medioPagoMonto = round2(neto * (medioPago / 100))
  // El descuento se calcula sobre el neto YA ajustado por medio de pago (no
  // sobre `neto` puro) — ver nota en el doc-comment de arriba, es lo que
  // mantiene este número consistente con la suma real de las bases de IVA.
  const netoConMedioPago = round2(neto + medioPagoMonto)
  const descuentoMonto = round2(netoConMedioPago * (disc / 100))
  const netoGravado = round2(netoConMedioPago - descuentoMonto)

  const iva: IvaBucket[] = []
  if (discriminado) {
    for (const [pct, baseSinAjuste] of Array.from(byRate.entries())) {
      if (pct <= 0) continue
      // El ajuste de medio de pago entra a la base gravada igual que el
      // descuento (ambos son % sobre el mismo neto) — netoGravado arriba es
      // justamente la suma de estas bases por alícuota, dentro del margen de
      // redondeo de centavos.
      const base = round2(baseSinAjuste * cardFactor * factor)
      const monto = round2(base * (pct / 100))
      if (monto > 0) iva.push({ pct, base, monto })
    }
    iva.sort((a, b) => b.pct - a.pct)
  }

  const ivaTotal = round2(iva.reduce((s, b) => s + b.monto, 0))
  const total = round2(netoGravado + ivaTotal)

  return { neto, medioPagoPct: medioPago, medioPagoMonto, descuentoPct: disc, descuentoMonto, netoGravado, discriminado, iva, ivaTotal, total }
}
