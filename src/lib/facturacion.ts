import { computeQuoteTotals, type QuoteLine } from '@/lib/quote-totals'

// Redondeo a 2 decimales — evita arrastrar error de punto flotante en cada
// línea pesificada (0.1 + 0.2 !== 0.3).
const round2 = (n: number) => Math.round(n * 100) / 100

// Numeración interna correlativa por organización — NO es un CAE de AFIP
// (Fase 5). Formato "F-00000123".
export function formatNumeroInterno(seq: number): string {
  return `F-${String(seq).padStart(8, '0')}`
}

export interface EmitirFacturaResult { ok: true; invoiceId: string; numeroInterno: string }
export interface EmitirFacturaError { ok: false; error: string; status: number }

// Crea una Invoice + InvoiceItem[] a partir de una cotización ACEPTADA,
// copiando líneas, total con IVA y vínculos (empresa, deal, cotización).
export async function emitirFacturaDesdeCotizacion(
  tx: any,
  cotizacionId: string,
  orgId: string,
  opts: { dueDate?: Date | null; tipo?: string | null; tcVendedor?: number | null } = {},
): Promise<EmitirFacturaResult | EmitirFacturaError> {
  const cot = await tx.cotizacion.findFirst({
    where: { id: cotizacionId, organizationId: orgId },
    select: { id: true, ref: true, items: true, discount: true, ivaDiscriminado: true, currency: true, empresaId: true, dealId: true, status: true },
  })
  if (!cot) return { ok: false, error: 'Cotización no encontrada', status: 404 }
  if (!cot.empresaId) return { ok: false, error: 'La cotización no tiene un cliente asignado', status: 400 }

  const yaFacturada = await tx.invoice.findFirst({
    where: { organizationId: orgId, cotizacionId: cot.id },
    select: { id: true, numeroInterno: true },
  })
  if (yaFacturada) return { ok: false, error: `Esta cotización ya se facturó (${yaFacturada.numeroInterno ?? 'sin número'})`, status: 409 }

  const rawItems = Array.isArray(cot.items) ? (cot.items as any[]) : []
  if (rawItems.length === 0) return { ok: false, error: 'La cotización no tiene ítems', status: 400 }

  const lines: QuoteLine[] = rawItems.map((it) => ({
    price: Number(it.price) || 0,
    quantity: Number(it.quantity) || 1,
    ivaPct: it.ivaPct ?? null,
    type: it.type,
  }))
  const totals = computeQuoteTotals(lines, cot.discount ?? 0, cot.ivaDiscriminado === true)

  // Pedido de Abba: el documento final de facturación SIEMPRE sale en ARS,
  // aunque la cotización de origen esté en USD (frecuente por costos de
  // importación) — se pesifica al TC BNA vendedor del día. El rate lo
  // resuelve el caller (fetch de dolarapi ANTES de abrir la transacción,
  // ver api/cotizaciones/[id]/emitir-factura/route.ts) porque pegarle a una
  // API externa desde DENTRO de una transacción de Prisma es una mala idea
  // (la deja abierta más de lo necesario, sujeta a timeout del pool).
  const rate = cot.currency === 'USD' ? opts.tcVendedor : null
  if (cot.currency === 'USD' && !rate) {
    return { ok: false, error: 'No se pudo obtener el tipo de cambio del día — probá de nuevo en un momento.', status: 503 }
  }
  const pesify = (n: number) => (rate ? round2(n * rate) : n)
  const invoiceCurrency = rate ? 'ARS' : cot.currency

  // Correlativo por org.
  const last = await tx.invoice.findFirst({
    where: { organizationId: orgId, numeroInterno: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { numeroInterno: true },
  })
  const lastSeq = last?.numeroInterno ? parseInt(String(last.numeroInterno).replace(/\D/g, ''), 10) || 0 : 0
  const numeroInterno = formatNumeroInterno(lastSeq + 1)

  const invoice = await tx.invoice.create({
    data: {
      empresaId: cot.empresaId,
      organizationId: orgId,
      amount: pesify(totals.total),
      currency: invoiceCurrency,
      tcUsado: rate ?? null,
      status: 'PENDING',
      description: `Factura de la cotización ${cot.ref}`,
      dueDate: opts.dueDate ?? new Date(Date.now() + 30 * 86_400_000),
      numeroInterno,
      tipo: opts.tipo ?? 'FACTURA',
      cotizacionId: cot.id,
      dealId: cot.dealId,
      subtotal: pesify(totals.netoGravado),
      iva: pesify(totals.ivaTotal),
      items: {
        create: rawItems.map((it) => {
          const cant = Math.max(1, Math.round(Number(it.quantity) || 1))
          const pu = pesify(Number(it.price) || 0)
          return {
            productId: typeof it.productId === 'string' ? it.productId : null,
            nombre: String(it.name ?? 'Ítem'),
            cantidad: cant,
            precioUnitario: pu,
            ivaPct: it.ivaPct ?? null,
            subtotal: round2(pu * cant),
          }
        }),
      },
    },
    select: { id: true },
  })

  return { ok: true, invoiceId: invoice.id, numeroInterno }
}
