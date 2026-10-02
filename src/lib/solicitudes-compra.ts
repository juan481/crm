// Listas curadas para Solicitud de Compra — texto libre por debajo
// (SolicitudCompra.condicionPago es String? en el schema), mismo criterio
// que ya usa src/lib/fiscal.ts para condición de IVA / forma de pago:
// agregar una condición nueva es tocar este archivo, no una migración.
export const CONDICIONES_PAGO = [
  'E-Check 0/30',
  'E-Check 30/60',
  'E-Check 30/60/90',
  'Contado',
]
export const OTRA_CONDICION_PAGO = 'Otra'

export const ESTADO_SOLICITUD_LABEL: Record<string, string> = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  RESPONDIDA: 'Respondida',
  ANULADA: 'Anulada',
}

export const ESTADO_SOLICITUD_COLOR: Record<string, string> = {
  BORRADOR: '#94a3b8',
  ENVIADA: '#3b82f6',
  RESPONDIDA: '#10b981',
  ANULADA: '#ef4444',
}
