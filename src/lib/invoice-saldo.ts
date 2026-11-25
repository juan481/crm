import { prisma } from '@/lib/db'

// Pagos parciales / cuenta corriente (pedido de Abba, Seba 2026-11-02 — caso
// "Poder Judicial": un presupuesto que el cliente paga en dos partes).
//
// Una factura ya no se cobra sólo "toda de una": cada cobro es un Payment
// APPROVED con su propio monto, y lo que falta es el SALDO de la factura.
// No hay columna nueva en Invoice — el saldo se DERIVA siempre de los
// Payment (fuente única, nunca se desincroniza):
//
//   cobrado = Σ Payment.amount (status APPROVED) de esa factura
//   saldo   = Invoice.amount − cobrado
//
// Se usa el BRUTO (amount), nunca netAmount: la comisión que se queda
// Whop/MP es un costo nuestro, no plata que el cliente siga debiendo.
// La factura pasa a PAID recién cuando el saldo llega a 0 (con tolerancia
// de medio centavo por redondeo) — hasta entonces sigue PENDING/OVERDUE y
// el saldo es lo que figura en la cuenta corriente del cliente.

export const SALDO_EPSILON = 0.005

export const round2 = (n: number) => Math.round(n * 100) / 100

export function saldoDe(amount: number, cobrado: number): number {
  const s = round2(amount - cobrado)
  return s <= SALDO_EPSILON ? 0 : s
}

/** Σ de cobros APPROVED por factura. Las que no tienen cobros no aparecen en el Map (= 0). */
export async function cobradoPorFactura(invoiceIds: string[], db: any = prisma): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (invoiceIds.length === 0) return out
  const groups = await db.payment.groupBy({
    by: ['invoiceId'],
    where: { invoiceId: { in: invoiceIds }, status: 'APPROVED' },
    _sum: { amount: true },
  })
  for (const g of groups) out.set(g.invoiceId, round2(g._sum.amount ?? 0))
  return out
}

/** Cobrado y saldo de UNA factura (para validar un cobro nuevo dentro de una transacción). */
export async function saldoFactura(invoiceId: string, amount: number, db: any = prisma): Promise<{ cobrado: number; saldo: number }> {
  const agg = await db.payment.aggregate({
    where: { invoiceId, status: 'APPROVED' },
    _sum: { amount: true },
  })
  const cobrado = round2(agg._sum.amount ?? 0)
  return { cobrado, saldo: saldoDe(amount, cobrado) }
}
