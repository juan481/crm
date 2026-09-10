import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { ensureInvoiceCheckout } from '@/lib/payments/checkout'
import { paymentsEnabledForOrg } from '@/lib/payments/config'

export const dynamic = 'force-dynamic'

interface Params { params: { token: string } }

// Ventana generosa: alguien puede recargar la página de pago varias veces.
const RATE_LIMIT = { max: 20, windowMinutes: 15 }

// Datos mínimos para pintar la página de pago pública /pagar/<token>.
// Sin login, token-gated (Invoice.payToken). No expone NADA fuera de esta
// factura: ni el listado, ni otras facturas, ni datos internos.
export async function GET(req: NextRequest, { params }: Params) {
  const ip = getClientIp(req)
  const { limited } = await checkRateLimit('pay_public', ip, RATE_LIMIT)
  if (limited) return NextResponse.json({ error: 'Demasiados intentos — probá de nuevo en un rato.' }, { status: 429 })

  const invoice = await prisma.invoice.findFirst({
    where: { payToken: params.token },
    select: {
      id: true, amount: true, currency: true, description: true, status: true, dueDate: true, organizationId: true,
    },
  })
  if (!invoice) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  // Candado multi-tenant: si esta org no cobra online, el link "no existe".
  if (!paymentsEnabledForOrg(invoice.organizationId)) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: invoice.organizationId },
    select: { name: true, crmName: true, logoUrl: true, primaryColor: true, secondaryColor: true },
  })
  if (!org) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })

  return NextResponse.json({
    data: {
      concepto: invoice.description || 'Pago de servicios',
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
      dueDate: invoice.dueDate.toISOString(),
      org: {
        name: org.name || org.crmName,
        logoUrl: org.logoUrl,
        primaryColor: org.primaryColor,
        secondaryColor: org.secondaryColor,
      },
    },
  })
}

// Crea (o devuelve) la URL de checkout hosteada y la responde para que el
// browser redirija. La conciliación real la hace el webhook, no este redirect.
export async function POST(req: NextRequest, { params }: Params) {
  const ip = getClientIp(req)
  const { limited } = await checkRateLimit('pay_public', ip, RATE_LIMIT)
  if (limited) return NextResponse.json({ error: 'Demasiados intentos — probá de nuevo en un rato.' }, { status: 429 })

  const invoice = await prisma.invoice.findFirst({
    where: { payToken: params.token },
    select: {
      id: true, amount: true, currency: true, description: true, status: true,
      payToken: true, paymentProvider: true, checkoutUrl: true, empresaId: true, organizationId: true,
    },
  })
  if (!invoice) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  if (!paymentsEnabledForOrg(invoice.organizationId)) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  }
  if (invoice.status === 'PAID') return NextResponse.json({ error: 'Esta factura ya fue pagada' }, { status: 409 })
  if (invoice.status === 'CANCELLED') return NextResponse.json({ error: 'Esta factura fue anulada' }, { status: 409 })

  try {
    const { url } = await ensureInvoiceCheckout(invoice, invoice.organizationId, req)
    return NextResponse.json({ data: { url } })
  } catch (err) {
    console.error('[PAY PUBLIC POST]', err)
    return NextResponse.json({ error: 'No se pudo iniciar el pago. Probá de nuevo en un rato.' }, { status: 502 })
  }
}
