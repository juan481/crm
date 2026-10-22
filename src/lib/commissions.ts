// Motor de comisiones (reestructuración Abba 2026-10) — ganancia por familia
// de producto × utilidad real de la empresa, registrado por factura PAGADA.
// Ver comentario completo en el modelo CommissionLedger (schema.prisma): NO
// guarda el % de comisión ni el monto a pagar, eso se resuelve en vivo en
// /api/commissions a partir de estas filas + el objetivo de venta del mes.
import { argentinaDayKey } from '@/lib/timezone'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

// "YYYY-MM" del día calendario ARGENTINO de hoy, no del UTC del server (ver
// src/lib/timezone.ts — mismo bug de siempre: una factura marcada Pagada
// después de las 21hs Argentina caía en el mes equivocado si esto usara
// new Date().getMonth() directo).
function currentMonth(): string {
  return argentinaDayKey().slice(0, 7)
}

// Tramo de comisión (10/15/20%) según cuánto del objetivo de venta del mes
// lleva cumplido el vendedor — confirmado por Seba: <50% → 10%, 50-99% →
// 15%, ≥100% → 20%. Se aplica sobre el TOTAL de utilidad del mes, no de
// forma marginal por tramo.
export function commissionTierPct(pctObjetivo: number): number {
  if (pctObjetivo >= 100) return 20
  if (pctObjetivo >= 50) return 15
  return 10
}

/**
 * Registra (o actualiza, si ya existía) la ganancia/utilidad de una factura
 * recién marcada PAGADA. Debe llamarse DENTRO de la misma transacción que la
 * marca como pagada (ver src/app/api/invoices/[id]/route.ts) — si la
 * atribución del vendedor o el margen de la familia no se puede resolver,
 * no crea nada (no inventa un número ni una comisión sin base real).
 *
 * `tx` es el cliente de Prisma de la transacción en curso (any, mismo
 * criterio que el resto del código que castea `prisma as any` por los
 * modelos agregados fuera del cliente tipado base).
 */
export async function recordCommissionForPaidInvoice(tx: any, organizationId: string, invoiceId: string): Promise<void> {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true, subtotal: true, currency: true, servicioRecurrenteId: true, cotizacionId: true, dealId: true,
      items: { select: { productId: true, subtotal: true } },
    },
  })
  if (!invoice || !invoice.items?.length) return
  // Solo ventas nuevas — un abono/renovación recurrente nunca genera
  // comisión (pedido explícito de Seba).
  if (invoice.servicioRecurrenteId) return

  // Vendedor: el que cotizó (Cotizacion.userId, respeta el "sellerId" que un
  // admin pudo haber cargado a nombre de otro al cotizar) y, si la factura
  // no vino de una cotización, el owner del Deal vinculado. Sin ninguno de
  // los dos no hay a quién atribuirle la comisión — se omite, no se adivina.
  const resolveUserId = async (): Promise<string | null> => {
    if (invoice.cotizacionId) {
      const cot = await tx.cotizacion.findUnique({ where: { id: invoice.cotizacionId }, select: { userId: true } })
      if (cot?.userId) return cot.userId
    }
    if (invoice.dealId) {
      const deal = await tx.deal.findUnique({ where: { id: invoice.dealId }, select: { ownerId: true } })
      if (deal?.ownerId) return deal.ownerId
    }
    return null
  }

  const productIds = Array.from(new Set((invoice.items as any[]).map((it) => it.productId).filter(Boolean))) as string[]

  // Ninguna de estas 4 consultas depende del resultado de las otras — corren
  // en paralelo para no alargar más de lo necesario la transacción en la
  // que esto corre (ver invoices/[id]/route.ts, que sostiene locks mientras
  // tanto).
  const [userId, org, existingLedger, products] = await Promise.all([
    resolveUserId(),
    tx.organization.findUnique({ where: { id: organizationId }, select: { utilidadRealPct: true } }),
    tx.commissionLedger.findUnique({ where: { invoiceId }, select: { month: true } }),
    productIds.length
      ? tx.product.findMany({ where: { id: { in: productIds }, organizationId }, select: { id: true, categoryId: true } })
      : Promise.resolve([] as any[]),
  ])
  if (!userId) return

  const utilidadRealPct: number = org?.utilidadRealPct ?? 0
  const categoryByProduct = new Map<string, string | null>(products.map((p: any) => [p.id, p.categoryId]))
  const categoryIds = Array.from(new Set(products.map((p: any) => p.categoryId).filter(Boolean))) as string[]
  const categories = categoryIds.length
    ? await tx.productCategory.findMany({ where: { id: { in: categoryIds }, organizationId }, select: { id: true, margenPct: true } })
    : []
  const margenByCategory = new Map<string, number | null>(categories.map((c: any) => [c.id, c.margenPct]))

  // InvoiceItem.subtotal es precio de lista × cantidad, SIN el descuento
  // comercial ni el ajuste de medio de pago que sí quedaron reflejados en
  // Invoice.subtotal (ver limitación conocida documentada en facturacion.ts
  // y el commit de cuotas automáticas) — para no sobre/sub-estimar la
  // ganancia real cobrada, se escala cada línea proporcionalmente a lo que
  // la factura terminó facturando de verdad.
  const rawSum = (invoice.items as any[]).reduce((s, it) => s + (Number(it.subtotal) || 0), 0)
  const scale = (rawSum > 0 && invoice.subtotal != null) ? (Number(invoice.subtotal) / rawSum) : 1

  let ganancia = 0
  for (const it of invoice.items as any[]) {
    if (!it.productId) continue // ítems sin producto (servicios, manuales) no aportan margen en esta v1
    const categoryId = categoryByProduct.get(it.productId)
    if (!categoryId) continue
    const margenPct = margenByCategory.get(categoryId)
    if (margenPct == null) continue // familia sin margen configurado todavía — no aporta
    const adjustedSubtotal = (Number(it.subtotal) || 0) * scale
    ganancia += adjustedSubtotal * (margenPct / 100)
  }
  ganancia = round2(ganancia)
  const utilidad = round2(ganancia * (utilidadRealPct / 100))
  // El mes se fija en la PRIMERA vez que se registra esta factura — si ya
  // existía una fila (se está recalculando tras corregir monto/moneda de
  // una factura que seguía Pagada, ver invoices/[id]/route.ts), el mes NO
  // se toca: corregir un monto semanas después no debe mover la venta de
  // mes (bug real encontrado en code-review — currentMonth() de nuevo acá
  // la hacía "saltar" al mes de la corrección, no el del pago real).
  const month = existingLedger?.month ?? currentMonth()

  // upsert, no create: si la factura se despaga y se vuelve a pagar, no
  // debe quedar un segundo registro duplicando la ganancia de la misma
  // venta (ver removeCommissionForInvoice, que borra la fila al despagar).
  await tx.commissionLedger.upsert({
    where: { invoiceId },
    update: { userId, month, currency: invoice.currency, ganancia, utilidad },
    create: { organizationId, userId, invoiceId, month, currency: invoice.currency, ganancia, utilidad },
  })
}

// Al des-marcar una factura como Pagada (vuelve a PENDING/OVERDUE/CANCELLED),
// su ganancia/utilidad deja de contar — "no aparece comisión si no pagó" es
// literal, incluye dejar de pagarla después.
export async function removeCommissionForInvoice(tx: any, invoiceId: string): Promise<void> {
  await tx.commissionLedger.deleteMany({ where: { invoiceId } })
}
