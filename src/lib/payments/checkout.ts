import { prisma } from '@/lib/db'
import { providerForCurrency } from './types'
import { createWhopInvoiceCheckout, whopConfigured } from './whop'
import { createMpInvoicePreference, mercadoPagoConfigured } from './mercadopago'

// Crea (o devuelve la cacheada) la URL de checkout hosteada para una factura.
// Se usa desde el link público /pagar/<token> y desde el portal del cliente.
//
// El monto/concepto/moneda salen SIEMPRE de la fila Invoice — nunca de algo
// que venga del navegador. Si el monto de la factura se edita después, el
// PATCH de /api/invoices/[id] limpia checkoutUrl/checkoutRef para forzar la
// recreación con el valor nuevo.

export interface InvoiceForCheckout {
  id: string
  amount: number
  currency: string
  description: string | null
  payToken: string | null
  paymentProvider: string | null
  checkoutUrl: string | null
  empresaId: string | null
}

export interface CheckoutInfo {
  url: string
  provider: 'WHOP' | 'MERCADOPAGO'
}

export function checkoutProviderConfigured(provider: 'WHOP' | 'MERCADOPAGO'): boolean {
  return provider === 'WHOP' ? whopConfigured() : mercadoPagoConfigured()
}

async function payerEmailForEmpresa(orgId: string, empresaId: string | null): Promise<string | null> {
  if (!empresaId) return null
  const c = await prisma.directorioContacto.findFirst({
    where: { organizationId: orgId, empresaId, email: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { email: true },
  })
  return c?.email ?? null
}

export async function ensureInvoiceCheckout(
  invoice: InvoiceForCheckout,
  organizationId: string,
): Promise<CheckoutInfo> {
  const provider = (invoice.paymentProvider as 'WHOP' | 'MERCADOPAGO' | null)
    ?? providerForCurrency(invoice.currency)

  if (invoice.checkoutUrl) return { url: invoice.checkoutUrl, provider }

  if (!invoice.payToken) throw new Error('La factura no tiene payToken')
  if (!checkoutProviderConfigured(provider)) {
    throw new Error(`El proveedor de pago (${provider}) no está configurado`)
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const concepto = invoice.description || 'Pago de servicios'
  const redirectUrl = `${appUrl}/pagar/${invoice.payToken}/gracias`

  let result: { url: string; ref: string }
  if (provider === 'WHOP') {
    result = await createWhopInvoiceCheckout({
      amount: invoice.amount,
      currency: invoice.currency,
      concepto,
      invoiceId: invoice.id,
      payToken: invoice.payToken,
      redirectUrl,
    })
  } else {
    const payerEmail = await payerEmailForEmpresa(organizationId, invoice.empresaId)
    result = await createMpInvoicePreference({
      amount: invoice.amount,
      currency: invoice.currency,
      concepto,
      invoiceId: invoice.id,
      payerEmail,
      successUrl: redirectUrl,
      notificationUrl: `${appUrl}/api/webhooks/mercadopago`,
    })
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { paymentProvider: provider, checkoutUrl: result.url, checkoutRef: result.ref },
  })

  return { url: result.url, provider }
}
