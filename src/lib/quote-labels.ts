// Textos de la columna "Cant." y del total por renglón en el PDF del
// presupuesto (cotizador y detalle de cotización usan los mismos).
//
// Pedido de Seba (Abba, 2026-11-25): un servicio mensual con cantidad 5 se
// imprimía "5 mes" y el cliente lo leía como "5 meses", cuando es "5 por mes"
// (ej. 5 cuentas de monitoreo a US$ 5 c/u = US$ 25 por mes). Ahora: "5 × mes"
// y el total del renglón lleva "/mes".

const PERIODO: Record<string, string> = { MONTHLY: 'mes', ANNUAL: 'año' }

export function cantidadPdf(type: string, quantity: number, billingCycle?: string | null, unit?: string | null): string {
  if (type === 'SERVICE') {
    const per = PERIODO[billingCycle ?? 'MONTHLY']
    return per ? `${quantity} × ${per}` : `${quantity} (pago único)`
  }
  return `${quantity} × ${unit || 'unidad'}`
}

// " /mes", " /año" o "" (pago único / producto) — va pegado al total del renglón.
export function sufijoPeriodoPdf(type: string, billingCycle?: string | null): string {
  if (type !== 'SERVICE') return ''
  const per = PERIODO[billingCycle ?? 'MONTHLY']
  return per ? ` /${per}` : ''
}
