// Pagos & Portal — tipos compartidos entre Whop, Mercado Pago y la
// conciliación (reconcile.ts). Server-only.

export type PayProvider = 'WHOP' | 'MERCADOPAGO'

/**
 * Proveedor por defecto según la moneda de la factura/abono.
 * USD (y cualquier otra que no sea ARS) → Whop. ARS → Mercado Pago.
 * Es sólo el default: `Invoice.paymentProvider` lo puede fijar explícito.
 */
export function providerForCurrency(currency: string): PayProvider {
  return currency.trim().toUpperCase() === 'ARS' ? 'MERCADOPAGO' : 'WHOP'
}

export interface CheckoutResult {
  /** URL hosteada a la que se redirige al comprador. Siempre absoluta. */
  url: string
  /** Id de sesión/preference del proveedor — se cachea en Invoice.checkoutRef. */
  ref: string
}

export type NormalizedStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'REFUNDED'

/**
 * Un evento de pago del webhook, ya normalizado y VERIFICADO (firma OK) —
 * lo que reconcile.ts necesita sin saber de qué proveedor vino.
 * Exactamente uno de `invoiceId` / `abonoId` viene seteado.
 */
export interface NormalizedPaymentEvent {
  provider: PayProvider
  /** Id del pago en el proveedor — clave de idempotencia (Payment.externalId). */
  externalId: string
  status: NormalizedStatus
  amount: number
  currency: string
  /** Factura puntual: metadata.invoiceId (Whop) / external_reference (MP). */
  invoiceId?: string
  /** Cobro recurrente de un abono: metadata.abonoId / external_reference. */
  abonoId?: string
  /**
   * Id del plan (Whop `plan_...`) cuando no hay metadata.abonoId — plan
   * creado a mano desde el dashboard del proveedor en vez de por el CRM. El
   * webhook resuelve el abono buscando ServicioRecurrente.subExternalId.
   */
  planId?: string
  /** Respuesta cruda del proveedor — se guarda en Payment.rawPayload. */
  raw: unknown
}

/** Ventana de tolerancia para el timestamp de la firma de un webhook. */
export const WEBHOOK_MAX_SKEW_MS = 5 * 60 * 1000
