import { recordManualPayment } from '@/lib/payments/reconcile'
import { recordCommissionForPaidInvoice, removeCommissionForInvoice } from '@/lib/commissions'
import { saldoFactura, round2, SALDO_EPSILON } from '@/lib/invoice-saldo'

// Cobros manuales con pagos parciales (pedido de Abba, Seba 2026-11-02).
// Ver src/lib/invoice-saldo.ts para el modelo (saldo derivado de Payment).
//
// Todas estas funciones corren DENTRO de una transacción (`tx`) y arrancan
// con un SELECT … FOR UPDATE sobre la fila de la factura: sin ese lock, dos
// cobros cargados a la vez (dos pestañas, doble click) leían el mismo saldo
// y podían cobrar más que el total de la factura.

export class CobroError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

async function lockInvoice(tx: any, invoiceId: string, organizationId: string) {
  await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`
  const inv = await tx.invoice.findFirst({
    where: { id: invoiceId, organizationId },
    select: { id: true, amount: true, currency: true, status: true, paidAt: true },
  })
  if (!inv) throw new CobroError('Factura no encontrada', 404)
  return inv as { id: string; amount: number; currency: string; status: string; paidAt: Date | null }
}

// Deja Invoice.status coherente con su saldo después de cualquier cambio en
// sus cobros: saldo 0 → PAID (y se "gana" la comisión, igual que antes);
// saldo > 0 en una factura que estaba PAID → vuelve a PENDING (y la
// comisión deja de contar — "no aparece comisión si no pagó"). Una factura
// CANCELLED no se toca. Siempre invalida el checkout online cacheado: el
// link de pago tiene que cobrar el saldo nuevo, no el viejo.
async function syncEstado(tx: any, inv: { id: string; amount: number; status: string; paidAt: Date | null }, organizationId: string) {
  const { cobrado, saldo } = await saldoFactura(inv.id, inv.amount, tx)
  let pagada = inv.status === 'PAID'
  if (inv.status !== 'CANCELLED') {
    if (saldo === 0 && inv.status !== 'PAID') {
      await tx.invoice.update({
        where: { id: inv.id },
        data: { status: 'PAID', paidAt: inv.paidAt ?? new Date(), checkoutUrl: null, checkoutRef: null },
      })
      await recordCommissionForPaidInvoice(tx, organizationId, inv.id)
      pagada = true
    } else if (saldo > 0 && inv.status === 'PAID') {
      await tx.invoice.update({
        where: { id: inv.id },
        data: { status: 'PENDING', paidAt: null, checkoutUrl: null, checkoutRef: null },
      })
      await removeCommissionForInvoice(tx, inv.id)
      pagada = false
    } else {
      await tx.invoice.update({ where: { id: inv.id }, data: { checkoutUrl: null, checkoutRef: null } })
    }
  }
  return { cobrado, saldo, pagada }
}

export interface CobroResult { paymentId: string; cobrado: number; saldo: number; pagada: boolean; monto: number; currency: string }

/**
 * Registra un cobro MANUAL de `monto` sobre la factura. `monto` null = cobrar
 * todo el saldo pendiente (comportamiento de siempre de "Registrar pago").
 */
export async function registrarCobro(tx: any, opts: {
  invoiceId: string
  organizationId: string
  monto: number | null
  metodo: string
  detalle: Record<string, unknown> | null
  fecha?: Date | null
}): Promise<CobroResult> {
  const inv = await lockInvoice(tx, opts.invoiceId, opts.organizationId)
  if (inv.status === 'CANCELLED') throw new CobroError('La factura está cancelada')
  if (inv.status === 'PAID') throw new CobroError('La factura ya está pagada por completo')

  const { saldo } = await saldoFactura(inv.id, inv.amount, tx)
  if (saldo <= 0) throw new CobroError('La factura no tiene saldo pendiente')

  const monto = opts.monto == null ? saldo : round2(opts.monto)
  if (!(monto > 0)) throw new CobroError('El monto a cobrar tiene que ser mayor a cero')
  if (monto > saldo + SALDO_EPSILON) {
    throw new CobroError(`El monto supera el saldo pendiente de la factura (${saldo.toFixed(2)} ${inv.currency})`)
  }

  const payment = await recordManualPayment({
    invoiceId: inv.id,
    organizationId: opts.organizationId,
    amount: monto,
    currency: inv.currency,
    metodo: opts.metodo,
    detalle: opts.detalle,
    client: tx,
  })
  if (opts.fecha) {
    await tx.payment.update({ where: { id: payment.id }, data: { paidAt: opts.fecha } })
  }

  const r = await syncEstado(tx, inv, opts.organizationId)
  return { paymentId: payment.id, ...r, monto, currency: inv.currency }
}

/** Corrige el MONTO de un cobro manual ya cargado (el medio/detalle se corrige aparte). */
export async function cambiarMontoCobro(tx: any, opts: { paymentId: string; organizationId: string; monto: number }) {
  const pay = await tx.payment.findFirst({
    where: { id: opts.paymentId, organizationId: opts.organizationId },
    select: { id: true, invoiceId: true, provider: true, status: true, amount: true },
  })
  if (!pay) throw new CobroError('Pago no encontrado', 404)
  if (pay.provider !== 'MANUAL') throw new CobroError('Sólo se puede corregir el monto de un pago manual')

  const inv = await lockInvoice(tx, pay.invoiceId, opts.organizationId)
  const monto = round2(opts.monto)
  if (!(monto > 0)) throw new CobroError('El monto tiene que ser mayor a cero')

  const { cobrado } = await saldoFactura(inv.id, inv.amount, tx)
  const cobradoSinEste = round2(cobrado - (pay.status === 'APPROVED' ? pay.amount : 0))
  const maximo = round2(inv.amount - cobradoSinEste)
  if (monto > maximo + SALDO_EPSILON) {
    throw new CobroError(`Con ese monto se cobraría más que el total de la factura (máximo ${maximo.toFixed(2)} ${inv.currency})`)
  }

  await tx.payment.update({ where: { id: pay.id }, data: { amount: monto } })
  return syncEstado(tx, inv, opts.organizationId)
}

/** Anula (borra) un cobro manual cargado por error. La factura vuelve a tener ese saldo pendiente. */
export async function anularCobro(tx: any, opts: { paymentId: string; organizationId: string }) {
  const pay = await tx.payment.findFirst({
    where: { id: opts.paymentId, organizationId: opts.organizationId },
    select: { id: true, invoiceId: true, provider: true },
  })
  if (!pay) throw new CobroError('Pago no encontrado', 404)
  // Un cobro de Whop/MP no se "anula" desde acá: la plata entró de verdad
  // por la pasarela, se revierte con un reembolso en el proveedor (que llega
  // por webhook como REFUNDED y ya se concilia solo).
  if (pay.provider !== 'MANUAL') throw new CobroError('Un cobro online no se anula desde acá — hacé el reembolso en la pasarela')

  const inv = await lockInvoice(tx, pay.invoiceId, opts.organizationId)
  await tx.payment.delete({ where: { id: pay.id } })
  return syncEstado(tx, inv, opts.organizationId)
}
