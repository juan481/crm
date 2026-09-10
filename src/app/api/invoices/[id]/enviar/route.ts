import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendEmail, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'
import { formatMoneyExact } from '@/lib/utils'
import { appBaseUrl } from '@/lib/app-url'
import { providerForCurrency } from '@/lib/payments/types'
import { checkoutProviderConfigured } from '@/lib/payments/checkout'
import { paymentsEnabledForOrg } from '@/lib/payments/config'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Muestra el monto con el código de moneda adelante para que no haya
// ambigüedad (ARS y USD comparten el símbolo "$" en formato es-AR).
function money(amount: number, currency: string): string {
  const n = formatMoneyExact(amount, currency).replace(/^[A-Z]{0,3}\s?\$?\s?/, '$')
  return `${currency} ${n}`
}

// POST /api/invoices/[id]/enviar — manda la factura por mail con el PDF
// adjunto (generado en el cliente, base64). Body: { pdfBase64, email? }.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const pdfBase64: string = body?.pdfBase64 ?? ''
    if (!pdfBase64) return NextResponse.json({ error: 'Falta el PDF' }, { status: 400 })

    const db = prisma as any
    const inv = await db.invoice.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      include: {
        empresa: { select: { id: true, name: true } },
        items: { orderBy: { createdAt: 'asc' }, select: { nombre: true, cantidad: true, subtotal: true } },
      },
    })
    if (!inv) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })

    // Link de pago (Pagos & Portal) — se incluye SÓLO si: la org está
    // habilitada para cobrar (PAYMENTS_ORG_IDS), la factura tiene payToken, no
    // está pagada, y el proveedor de su moneda (Whop USD / MP ARS) está
    // configurado.
    const appUrl = appBaseUrl(req)
    const provider = (inv.paymentProvider as 'WHOP' | 'MERCADOPAGO' | null) ?? providerForCurrency(inv.currency)
    const payUrl = paymentsEnabledForOrg(payload.orgId)
      && inv.payToken && inv.status !== 'PAID' && appUrl && checkoutProviderConfigured(provider)
      ? `${appUrl}/pagar/${inv.payToken}`
      : null

    // El destino sale SIEMPRE de los contactos de la empresa de la factura.
    const contactos = inv.empresaId
      ? await db.directorioContacto.findMany({
          where: { organizationId: payload.orgId, empresaId: inv.empresaId, email: { not: null } },
          select: { email: true },
        })
      : []
    const mails: string[] = contactos.map((c: any) => String(c.email).trim().toLowerCase()).filter(Boolean)
    const pedido = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const email = pedido && mails.includes(pedido) ? pedido : mails[0] ?? null
    if (!email) {
      return NextResponse.json({ error: 'La empresa de la factura no tiene ningún contacto con email. Cargá uno en su ficha.' }, { status: 400 })
    }

    const org = await prisma.organization.findUnique({
      where: { id: payload.orgId },
      select: {
        name: true, crmName: true, logoUrl: true, primaryColor: true, secondaryColor: true, paymentInstructions: true,
        smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
        smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
      },
    })
    if (!org || !isOrgEmailConfigured(org)) {
      return NextResponse.json({ error: 'El email de la organización no está configurado (Configuración → Correo).' }, { status: 400 })
    }

    const orgName = org.name || org.crmName || 'CRM'
    const numero = inv.numeroInterno ?? `#${inv.id.slice(-6).toUpperCase()}`
    const vence = new Date(inv.dueDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
    const html = renderInvoiceEmail({
      orgName,
      logoUrl: org.logoUrl,
      accent: org.primaryColor || '#16a34a',
      numero,
      empresaName: inv.empresa?.name ?? null,
      concepto: inv.description ?? null,
      amount: inv.amount,
      currency: inv.currency,
      subtotal: inv.subtotal ?? null,
      iva: inv.iva ?? null,
      vence,
      items: (inv.items ?? []).map((it: any) => ({ nombre: String(it.nombre), cantidad: it.cantidad ?? 1, subtotal: it.subtotal ?? 0 })),
      payUrl,
      paymentInstructions: org.paymentInstructions ?? null,
    })

    const base64Data = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64
    await sendEmail({
      to: email,
      subject: `Factura ${numero} — ${orgName}`,
      html,
      smtpConfig: resolveOrgSmtpConfig(org),
      attachments: [{ filename: `Factura-${String(numero).replace(/[^\w-]/g, '')}.pdf`, content: Buffer.from(base64Data, 'base64'), contentType: 'application/pdf' }],
    })

    await db.invoice.update({ where: { id: inv.id }, data: { sentAt: new Date() } })
    return NextResponse.json({ message: `Factura enviada a ${email}` })
  } catch (error) {
    console.error('[INVOICE ENVIAR]', error)
    return NextResponse.json({ error: 'Error al enviar la factura' }, { status: 500 })
  }
}

interface InvoiceEmailData {
  orgName: string
  logoUrl: string | null
  accent: string
  numero: string
  empresaName: string | null
  concepto: string | null
  amount: number
  currency: string
  subtotal: number | null
  iva: number | null
  vence: string
  items: { nombre: string; cantidad: number; subtotal: number }[]
  payUrl: string | null
  paymentInstructions: string | null
}

function renderInvoiceEmail(d: InvoiceEmailData): string {
  const itemRows = d.items.length
    ? d.items.map((it, i) => `
      <tr style="background:${i % 2 ? '#f8fafc' : '#ffffff'}">
        <td style="padding:10px 14px;font-size:13px;color:#1e293b">${esc(it.nombre)}${it.cantidad > 1 ? ` <span style="color:#94a3b8">×${it.cantidad}</span>` : ''}</td>
        <td style="padding:10px 14px;font-size:13px;color:#1e293b;text-align:right;white-space:nowrap">${esc(money(it.subtotal, d.currency))}</td>
      </tr>`).join('')
    : `<tr><td style="padding:10px 14px;font-size:13px;color:#1e293b">${esc(d.concepto || 'Servicios')}</td>
        <td style="padding:10px 14px;font-size:13px;color:#1e293b;text-align:right;white-space:nowrap">${esc(money(d.amount, d.currency))}</td></tr>`

  const totalsRows = (d.subtotal != null ? `
      <tr><td style="padding:4px 14px;font-size:12px;color:#64748b;text-align:right">Subtotal</td>
          <td style="padding:4px 14px;font-size:12px;color:#64748b;text-align:right;white-space:nowrap">${esc(money(d.subtotal, d.currency))}</td></tr>` : '')
    + (d.iva ? `
      <tr><td style="padding:4px 14px;font-size:12px;color:#64748b;text-align:right">IVA</td>
          <td style="padding:4px 14px;font-size:12px;color:#64748b;text-align:right;white-space:nowrap">${esc(money(d.iva, d.currency))}</td></tr>` : '')

  const payBlock = d.payUrl ? `
    <tr><td style="padding:8px 28px 4px">
      <a href="${d.payUrl}" style="display:block;background:${d.accent};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;text-align:center;padding:14px 0;border-radius:12px">Pagar ahora</a>
    </td></tr>
    <tr><td style="padding:6px 28px 0;text-align:center;font-size:11px;color:#94a3b8">
      Pago seguro. Si el botón no funciona, copiá este link:<br/>
      <a href="${d.payUrl}" style="color:#94a3b8;word-break:break-all">${d.payUrl}</a>
    </td></tr>` : ''

  const instrBlock = (!d.payUrl && d.paymentInstructions) ? `
    <tr><td style="padding:8px 28px 0;font-size:12px;color:#64748b;line-height:1.6">
      <strong style="color:#334155">Datos de pago:</strong><br/>${esc(d.paymentInstructions).replace(/\n/g, '<br/>')}
    </td></tr>` : ''

  const brandHead = d.logoUrl
    ? `<img src="${d.logoUrl}" alt="${esc(d.orgName)}" style="max-height:36px;max-width:180px;display:block" />`
    : `<span style="font-size:18px;font-weight:700;color:#0f172a">${esc(d.orgName)}</span>`

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">

        <tr><td style="padding:22px 28px;border-bottom:1px solid #e2e8f0">${brandHead}</td></tr>

        <tr><td style="padding:24px 28px 4px">
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1.5px;color:${d.accent};text-transform:uppercase">Factura ${esc(d.numero)}</p>
          ${d.empresaName ? `<p style="margin:4px 0 0;font-size:13px;color:#64748b">Facturado a ${esc(d.empresaName)}</p>` : ''}
        </td></tr>

        <tr><td style="padding:12px 28px 4px">
          <p style="margin:0;font-size:13px;color:#64748b">Total a pagar</p>
          <p style="margin:2px 0 0;font-size:32px;font-weight:800;color:#0f172a;letter-spacing:-.5px">${esc(money(d.amount, d.currency))}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#94a3b8">Vencimiento: ${esc(d.vence)}</p>
        </td></tr>

        <tr><td style="padding:16px 28px 4px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
            <tr style="background:#f1f5f9"><td style="padding:8px 14px;font-size:10px;font-weight:700;letter-spacing:.5px;color:#94a3b8;text-transform:uppercase">Concepto</td>
              <td style="padding:8px 14px;font-size:10px;font-weight:700;letter-spacing:.5px;color:#94a3b8;text-transform:uppercase;text-align:right">Importe</td></tr>
            ${itemRows}
            ${totalsRows}
          </table>
        </td></tr>

        ${payBlock}
        ${instrBlock}

        <tr><td style="padding:16px 28px 24px;font-size:12px;color:#94a3b8;line-height:1.6">
          Adjuntamos la factura en PDF. Cualquier duda respondé a este correo.<br/>
          — ${esc(d.orgName)}
        </td></tr>

        <tr><td style="padding:14px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8">
          Enviado por ${esc(d.orgName)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
