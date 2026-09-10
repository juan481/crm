import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { fireWebhook } from '@/lib/webhooks'
import { notifyOrgStaff } from '@/lib/staff-notify'
import { getOrgActorUserId } from '@/lib/org-actor'
import { formatMoneyExact } from '@/lib/utils'
import { argentinaDayStart, dateOnlyArgentina } from '@/lib/timezone'
import { clampDiaVencimiento } from '@/lib/servicios-recurrentes'
import { paymentsEnabledForOrg } from './config'
import type { NormalizedPaymentEvent } from './types'

// Conciliación de pagos — el ÚNICO lugar que pasa una Invoice a PAID desde un
// webhook de pago. Idempotente por el @@unique([provider, externalId]) de
// Payment: un reintento del proveedor no crea un segundo Payment ni vuelve a
// disparar avisos.
//
// Tolerancia de monto: los proveedores redondean/convierten; se acepta una
// diferencia de hasta el 2% o $1 (lo que sea mayor). Una diferencia más
// grande con un pago APPROVED es sospechosa → se registra el Payment como
// REJECTED, NO se toca la factura y se alerta al staff.
const AMOUNT_TOLERANCE_PCT = 0.02
const AMOUNT_TOLERANCE_ABS = 1

export interface ReconcileResult {
  ok: boolean
  reason?: string
  invoiceId?: string
  alreadyProcessed?: boolean
}

function amountMatches(expected: number, got: number): boolean {
  const diff = Math.abs(expected - got)
  return diff <= Math.max(AMOUNT_TOLERANCE_ABS, expected * AMOUNT_TOLERANCE_PCT)
}

const oldestAdminId = getOrgActorUserId
const notifyStaff = notifyOrgStaff

/**
 * Concilia el pago de una factura PUNTUAL (event.invoiceId presente).
 */
export async function reconcileInvoicePayment(event: NormalizedPaymentEvent): Promise<ReconcileResult> {
  if (!event.invoiceId) return { ok: false, reason: 'sin invoiceId' }

  const invoice = await prisma.invoice.findUnique({
    where: { id: event.invoiceId },
    select: {
      id: true, organizationId: true, amount: true, currency: true, status: true,
      description: true, empresaId: true,
      empresa: { select: { id: true, name: true } },
    },
  })
  if (!invoice) return { ok: false, reason: 'factura inexistente' }
  // Candado multi-tenant (defensa en profundidad): si esta org no cobra
  // online, no debería haber llegado un pago — no se toca la factura.
  if (!paymentsEnabledForOrg(invoice.organizationId)) {
    console.warn('[RECONCILE] pago para org sin cobro habilitado, ignorado:', invoice.organizationId, event.externalId)
    return { ok: false, reason: 'org sin cobro habilitado' }
  }

  return applyPaymentToInvoice(event, invoice)
}

type InvoiceLite = {
  id: string; organizationId: string; amount: number; currency: string; status: string
  description: string | null; empresaId: string | null
  empresa: { id: string; name: string } | null
}

async function applyPaymentToInvoice(event: NormalizedPaymentEvent, invoice: InvoiceLite): Promise<ReconcileResult> {
  const empresaName = invoice.empresa?.name ?? 'Cliente'
  const currencyOk = event.currency.toUpperCase() === invoice.currency.toUpperCase()
  const amountOk = amountMatches(invoice.amount, event.amount)

  // ── Reembolso / contracargo ──
  if (event.status === 'REFUNDED') {
    await recordPayment(event, invoice.id, invoice.organizationId, 'REFUNDED')
    if (invoice.status === 'PAID') {
      await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'PENDING', paidAt: null } })
    }
    await notifyStaff(
      invoice.organizationId,
      `⚠️ Reembolso/contracargo — ${empresaName}`,
      `Se reembolsó o revirtió un pago de ${formatMoneyExact(event.amount, event.currency)} de ${empresaName} (${invoice.description ?? 'factura'}).\n\nLa factura volvió a estado Pendiente. Revisala en Facturación.`,
    )
    return { ok: true, invoiceId: invoice.id }
  }

  // ── Pago no aprobado (pending / rejected) — se registra, no toca la factura ──
  if (event.status !== 'APPROVED') {
    await recordPayment(event, invoice.id, invoice.organizationId, event.status)
    return { ok: true, invoiceId: invoice.id }
  }

  // ── Pago aprobado pero monto/moneda no coinciden — sospechoso ──
  if (!currencyOk || !amountOk) {
    await recordPayment(event, invoice.id, invoice.organizationId, 'REJECTED')
    await notifyStaff(
      invoice.organizationId,
      `⚠️ Pago con monto distinto — ${empresaName}`,
      `Entró un pago de ${formatMoneyExact(event.amount, event.currency)} para una factura de ${formatMoneyExact(invoice.amount, invoice.currency)} (${empresaName}).\n\nNO se marcó como pagada. Revisá el pago en el proveedor y en Facturación.`,
    )
    return { ok: false, reason: 'monto/moneda no coincide', invoiceId: invoice.id }
  }

  // ── Pago aprobado y todo cierra ──
  const inserted = await recordPayment(event, invoice.id, invoice.organizationId, 'APPROVED')
  if (!inserted) return { ok: true, invoiceId: invoice.id, alreadyProcessed: true }

  if (invoice.status !== 'PAID') {
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'PAID', paidAt: new Date() } })

    if (invoice.empresaId) {
      const adminId = await oldestAdminId(invoice.organizationId)
      if (adminId) {
        await prisma.empresaNota.create({
          data: {
            empresaId: invoice.empresaId,
            organizationId: invoice.organizationId,
            userId: adminId,
            tipo: 'NOTA',
            content: `💰 Pago recibido — ${formatMoneyExact(event.amount, event.currency)} vía ${event.provider === 'WHOP' ? 'Whop' : 'Mercado Pago'} (${invoice.description ?? 'factura'}).`,
          },
        })
      }
    }

    fireWebhook(invoice.organizationId, 'invoice.paid', {
      id: invoice.id, amount: invoice.amount, currency: invoice.currency,
      description: invoice.description, empresa: empresaName, provider: event.provider,
    })

    await notifyStaff(
      invoice.organizationId,
      `✅ Cobro recibido — ${empresaName}`,
      `${empresaName} pagó ${formatMoneyExact(event.amount, event.currency)} (${invoice.description ?? 'factura'}) vía ${event.provider === 'WHOP' ? 'Whop' : 'Mercado Pago'}.\n\nLa factura quedó marcada como Pagada.`,
    )
  }

  return { ok: true, invoiceId: invoice.id }
}

/**
 * Concilia un cobro RECURRENTE de un abono con débito automático
 * (event.abonoId presente). Crea (o reutiliza) la factura del mes en curso
 * para ese abono y la marca PAID.
 */
export async function reconcileAbonoPayment(event: NormalizedPaymentEvent): Promise<ReconcileResult> {
  if (!event.abonoId) return { ok: false, reason: 'sin abonoId' }

  const abono = await prisma.servicioRecurrente.findUnique({
    where: { id: event.abonoId },
    select: {
      id: true, organizationId: true, nombre: true, monto: true, moneda: true,
      diaVencimiento: true, empresaId: true, subStatus: true,
      empresa: { select: { id: true, name: true, isCliente: true } },
    },
  })
  if (!abono) return { ok: false, reason: 'abono inexistente' }
  if (!paymentsEnabledForOrg(abono.organizationId)) {
    console.warn('[RECONCILE] cobro de abono para org sin cobro habilitado, ignorado:', abono.organizationId)
    return { ok: false, reason: 'org sin cobro habilitado' }
  }

  // El primer cobro recurrente confirma la autorización del débito.
  if (event.status === 'APPROVED' && abono.subStatus && abono.subStatus !== 'ACTIVO') {
    await prisma.servicioRecurrente.update({ where: { id: abono.id }, data: { subStatus: 'ACTIVO' } })
  }

  // Reembolso de un cobro recurrente — sólo se registra + alerta (no hay una
  // factura "abierta" que revertir necesariamente).
  if (event.status === 'REFUNDED') {
    const inv = await currentMonthAbonoInvoice(abono.id)
    if (inv) {
      await recordPayment(event, inv.id, abono.organizationId, 'REFUNDED')
      if (inv.status === 'PAID') {
        await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'PENDING', paidAt: null } })
      }
    }
    await notifyStaff(
      abono.organizationId,
      `⚠️ Reembolso de abono — ${abono.empresa?.name ?? 'Cliente'}`,
      `Se revirtió un cobro de ${formatMoneyExact(event.amount, event.currency)} del abono "${abono.nombre}".`,
    )
    return { ok: true, invoiceId: inv?.id }
  }

  if (event.status !== 'APPROVED') return { ok: true }

  const now = new Date()
  const arg = argentinaDayStart(now)
  const y = arg.getUTCFullYear()
  const mIdx = arg.getUTCMonth()
  const monthLabel = now.toLocaleString('es', { month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })

  // ¿Ya hay factura de este abono este mes calendario? (idempotencia, mismo
  // criterio que billAbonosForOrg)
  let invoice = await currentMonthAbonoInvoice(abono.id)

  if (!invoice) {
    const dueDate = dateOnlyArgentina(y, mIdx + 1, clampDiaVencimiento(abono.diaVencimiento))
    invoice = await prisma.invoice.create({
      data: {
        empresaId: abono.empresaId,
        organizationId: abono.organizationId,
        servicioRecurrenteId: abono.id,
        amount: abono.monto,
        currency: abono.moneda || 'USD',
        description: `${abono.nombre} — ${monthLabel}`,
        dueDate,
        status: 'PENDING',
      },
      select: { id: true, status: true, description: true },
    })
  }

  const inserted = await recordPayment(event, invoice.id, abono.organizationId, 'APPROVED')
  if (!inserted) return { ok: true, invoiceId: invoice.id, alreadyProcessed: true }

  if (invoice.status !== 'PAID') {
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'PAID', paidAt: new Date() } })
    fireWebhook(abono.organizationId, 'invoice.paid', {
      id: invoice.id, amount: abono.monto, currency: abono.moneda,
      description: invoice.description, empresa: abono.empresa?.name ?? null, provider: event.provider, recurring: true,
    })
    await notifyStaff(
      abono.organizationId,
      `✅ Débito automático — ${abono.empresa?.name ?? 'Cliente'}`,
      `Se cobró automáticamente ${formatMoneyExact(event.amount, event.currency)} del abono "${abono.nombre}" (${monthLabel}) vía ${event.provider === 'WHOP' ? 'Whop' : 'Mercado Pago'}.`,
    )
  }

  return { ok: true, invoiceId: invoice.id }
}

async function currentMonthAbonoInvoice(abonoId: string) {
  const arg = argentinaDayStart(new Date())
  const y = arg.getUTCFullYear()
  const mIdx = arg.getUTCMonth()
  const startOfMonth = new Date(Date.UTC(y, mIdx, 1))
  const endOfMonth = new Date(Date.UTC(y, mIdx + 1, 1))
  return prisma.invoice.findFirst({
    where: { servicioRecurrenteId: abonoId, createdAt: { gte: startOfMonth, lt: endOfMonth } },
    select: { id: true, status: true, description: true },
  })
}

/**
 * Inserta el Payment. Devuelve `true` si lo creó, `false` si ya existía
 * (idempotencia — reintento del webhook del proveedor).
 */
async function recordPayment(
  event: NormalizedPaymentEvent,
  invoiceId: string,
  organizationId: string,
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'REFUNDED',
): Promise<boolean> {
  try {
    await prisma.payment.create({
      data: {
        organizationId,
        invoiceId,
        provider: event.provider,
        externalId: event.externalId,
        status,
        amount: event.amount,
        currency: event.currency,
        rawPayload: event.raw as object,
        paidAt: status === 'APPROVED' ? new Date() : null,
      },
    })
    return true
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'P2002') {
      return false
    }
    throw err
  }
}

/**
 * Conciliación MANUAL de una transferencia (Abba y cualquier pago fuera de
 * pasarela). La invoca el botón "Registrar pago / marcar pagada" del CRM.
 */
export async function recordManualPayment(opts: {
  invoiceId: string
  organizationId: string
  amount: number
  currency: string
  note?: string
}): Promise<void> {
  await prisma.payment.create({
    data: {
      organizationId: opts.organizationId,
      invoiceId: opts.invoiceId,
      provider: 'MANUAL',
      externalId: `manual-${crypto.randomUUID()}`,
      status: 'APPROVED',
      amount: opts.amount,
      currency: opts.currency,
      rawPayload: opts.note ? { note: opts.note } : undefined,
      paidAt: new Date(),
    },
  })
}
