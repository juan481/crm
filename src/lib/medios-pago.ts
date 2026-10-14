// Medio de pago de un cobro MANUAL (Payment.metodo) — pedido de Abba:
// Facturación (Norma) tiene que poder elegir cómo se cobró una factura, no
// sólo marcarla "Pagada" a ciegas. String libre + lista curada (no enum
// Prisma), mismo criterio que el resto del catálogo de listas fijas del CRM.
export const MEDIO_PAGO_OPTIONS = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'TARJETA', label: 'Tarjeta' },
] as const

export type MedioPago = (typeof MEDIO_PAGO_OPTIONS)[number]['value']
export const MEDIO_PAGO_VALUES: string[] = MEDIO_PAGO_OPTIONS.map((o) => o.value)

export const medioPagoLabel = (value: string | null | undefined): string | null =>
  MEDIO_PAGO_OPTIONS.find((o) => o.value === value)?.label ?? null

// Detalle estructurado por medio de pago — vive en Payment.rawPayload (Json).
// Todos los campos son opcionales: Norma puede guardar sólo lo que tiene a
// mano y completar el resto después (es editable sin anular la factura).
export interface PagoDetalle {
  nota?: string // EFECTIVO
  referencia?: string // TRANSFERENCIA
  chequeNumero?: string
  chequeBanco?: string
  chequeFecha?: string
  foto?: string // data URI, comprobante/cheque — CHEQUE o cualquier medio
  tarjetaBancoEmisor?: string
  tarjetaMarca?: string
  tarjetaCuotas?: number
}
