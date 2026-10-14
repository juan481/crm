// Modalidad de retiro/entrega de un remito (EntregaStock.tipoEntrega) —
// pedido de Abba: distinguir si retira el cliente, lo entrega un técnico,
// o lo maneja un flete/transportista. String libre + lista curada (no enum
// Prisma) para poder sumar valores sin migración, mismo criterio que el
// resto del catálogo de listas fijas del CRM.
export const TIPO_ENTREGA_OPTIONS = [
  { value: 'CLIENTE', label: 'Retira el cliente' },
  { value: 'TECNICO', label: 'Entrega un técnico' },
  { value: 'FLETE', label: 'Flete' },
  { value: 'TRANSPORTISTA', label: 'Transportista' },
] as const

export type TipoEntrega = (typeof TIPO_ENTREGA_OPTIONS)[number]['value']

export const tipoEntregaLabel = (value: string | null | undefined): string | null =>
  TIPO_ENTREGA_OPTIONS.find((o) => o.value === value)?.label ?? null
