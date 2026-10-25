// Gastos del día a día — constantes compartidas entre la pantalla /gastos
// (client) y la API. Sin imports de servidor.

// Lista curada; el campo es texto libre (crece sin migración) — si alguien
// necesita otra, se agrega acá.
export const CATEGORIAS_GASTO = [
  'Combustible',
  'Viáticos y comidas',
  'Librería y oficina',
  'Servicios (luz, internet, teléfono)',
  'Mantenimiento y reparaciones',
  'Vehículos',
  'Materiales e insumos',
  'Impuestos y tasas',
  'Sueldos y honorarios',
  'Publicidad',
  'Otros',
] as const

export const MEDIOS_PAGO_GASTO: { value: string; label: string }[] = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'TARJETA', label: 'Tarjeta' },
  { value: 'MERCADOPAGO', label: 'Mercado Pago' },
  { value: 'CHEQUE', label: 'Cheque / e-cheq' },
  { value: 'OTRO', label: 'Otro' },
]

export const MEDIO_PAGO_GASTO_LABEL: Record<string, string> = Object.fromEntries(MEDIOS_PAGO_GASTO.map((m) => [m.value, m.label]))

export const MONEDAS_GASTO = ['ARS', 'USD'] as const
