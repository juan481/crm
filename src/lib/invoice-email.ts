import { prisma } from '@/lib/db'
import { sendEmail, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'
import { getOrgActorUserId } from '@/lib/org-actor'
import { formatMoneyExact } from '@/lib/utils'
import { appBaseUrl } from '@/lib/app-url'
import { providerForCurrency } from '@/lib/payments/types'
import { checkoutProviderConfigured } from '@/lib/payments/checkout'
import { paymentsEnabledForOrg } from '@/lib/payments/config'

// Envío de una factura por email — usado por el botón "Enviar por mail"
// (con PDF adjunto generado en el browser) y por el cron invoice-automation
// (sin PDF, sólo el mail con el link de pago). Deja `sentAt` y una nota en la
// timeline de la empresa como comprobante.

export interface SendInvoiceEmailResult {
  ok: boolean
  to?: string
  error?: string
}

export async function sendInvoiceEmail(opts: {
  invoiceId: string
  organizationId: string
  /** PDF en base64 (data URI o crudo). Si no viene, el mail va sin adjunto. */
  pdfBase64?: string
  /** Email pedido explícitamente — tiene que coincidir con un contacto de la empresa. */
  requestedEmail?: string
  req?: { headers: Headers }
}): Promise<SendInvoiceEmailResult> {
  const db = prisma as any

  const inv = await db.invoice.findFirst({
    where: { id: opts.invoiceId, organizationId: opts.organizationId },
    include: {
      empresa: { select: { id: true, name: true } },
      items: { orderBy: { createdAt: 'asc' }, select: { nombre: true, cantidad: true, subtotal: true } },
    },
  })
  if (!inv) return { ok: false, error: 'Factura no encontrada' }

  // Destino: siempre de los contactos de la empresa. Nunca un email libre.
  // Orden: primero el marcado "recibe facturas", después el más antiguo.
  const contactos = inv.empresaId
    ? await db.directorioContacto.findMany({
        where: { organizationId: opts.organizationId, empresaId: inv.empresaId, email: { not: null } },
        orderBy: [{ recibeFacturas: 'desc' }, { createdAt: 'asc' }],
        select: { email: true },
      })
    : []
  const mails: string[] = contactos.map((c: any) => String(c.email).trim().toLowerCase()).filter(Boolean)
  const pedido = opts.requestedEmail?.trim().toLowerCase() ?? ''
  const email = pedido && mails.includes(pedido) ? pedido : mails[0] ?? null
  if (!email) return { ok: false, error: 'La empresa de la factura no tiene ningún contacto con email. Cargá uno en su ficha.' }

  const org = await prisma.organization.findUnique({
    where: { id: opts.organizationId },
    select: {
      name: true, crmName: true, logoUrl: true, primaryColor: true, secondaryColor: true, paymentInstructions: true,
      smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
      smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
    },
  })
  if (!org || !isOrgEmailConfigured(org)) {
    return { ok: false, error: 'El email de la organización no está configurado (Configuración → Correo).' }
  }

  // Link de pago — sólo si: el medio de cobro no es MANUAL (transferencia), la
  // org cobra online, la factura tiene payToken, no está pagada, y el proveedor
  // está configurado. Si es MANUAL, el mail muestra las instrucciones de pago.
  const appUrl = appBaseUrl(opts.req)
  const manual = inv.paymentProvider === 'MANUAL'
  const provider = manual ? 'MERCADOPAGO' : ((inv.paymentProvider as 'WHOP' | 'MERCADOPAGO' | null) ?? providerForCurrency(inv.currency))
  const payUrl = !manual && paymentsEnabledForOrg(opts.organizationId)
    && inv.payToken && inv.status !== 'PAID' && appUrl && checkoutProviderConfigured(provider)
    ? `${appUrl}/pagar/${inv.payToken}`
    : null

  const orgName = org.name || org.crmName || 'CRM'
  const numero = inv.numeroInterno ?? `#${inv.id.slice(-6).toUpperCase()}`
  const vence = new Date(inv.dueDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

  const html = renderInvoiceEmail({
    orgName,
    logoUrl: org.logoUrl,
    accent: org.primaryColor || '#6366f1',
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
    hasPdf: !!opts.pdfBase64,
  })

  const attachments = opts.pdfBase64
    ? [{
        filename: `Factura-${String(numero).replace(/[^\w-]/g, '')}.pdf`,
        content: Buffer.from(opts.pdfBase64.includes(',') ? opts.pdfBase64.split(',')[1] : opts.pdfBase64, 'base64'),
        contentType: 'application/pdf',
      }]
    : undefined

  await sendEmail({
    to: email,
    subject: `Factura ${numero} — ${orgName}`,
    html,
    smtpConfig: resolveOrgSmtpConfig(org),
    attachments,
  })

  await db.invoice.update({ where: { id: inv.id }, data: { sentAt: new Date() } })

  // Comprobante en la timeline de la empresa.
  if (inv.empresaId) {
    const actorId = await getOrgActorUserId(opts.organizationId)
    if (actorId) {
      await db.empresaNota.create({
        data: {
          empresaId: inv.empresaId,
          organizationId: opts.organizationId,
          userId: actorId,
          tipo: 'NOTA',
          content: `📧 Factura ${numero} (${money(inv.amount, inv.currency)}) enviada a ${email}.`,
        },
      }).catch((err: unknown) => console.error('[INVOICE-EMAIL] nota falló:', err))
    }
  }

  return { ok: true, to: email }
}

// ─── Render del HTML ──────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Oscurece un hex (#rrggbb) por un factor — para el degradé del header.
function darken(hex: string, factor = 0.72): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return '#4338ca'
  const n = parseInt(m[1], 16)
  const r = Math.round(((n >> 16) & 255) * factor)
  const g = Math.round(((n >> 8) & 255) * factor)
  const b = Math.round((n & 255) * factor)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

// Monto con el código de moneda adelante (ARS y USD comparten "$" en es-AR).
function money(amount: number, currency: string): string {
  const n = formatMoneyExact(amount, currency).replace(/^[A-Z]{0,3}\s?\$?\s?/, '$')
  return `${currency} ${n}`
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
  hasPdf: boolean
}

export function renderInvoiceEmail(d: InvoiceEmailData): string {
  const FONT = "'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
  // Color 100% de la organización. Fallback al default del sistema (#6366f1),
  // nunca a un color de una marca concreta.
  const accent = /^#[0-9a-f]{6}$/i.test(d.accent) ? d.accent : '#6366f1'
  const accentDark = darken(accent, 0.68)
  const rows = d.items.length ? d.items : [{ nombre: d.concepto || 'Servicios', cantidad: 1, subtotal: d.amount }]

  const itemRows = rows.map((it, i) => `
      <tr>
        <td style="padding:12px 18px;font-size:13px;color:#1e293b;font-family:${FONT};border-top:${i ? '1px solid #eef2f6' : 'none'}">${esc(it.nombre)}${it.cantidad > 1 ? ` <span style="color:#94a3b8">× ${it.cantidad}</span>` : ''}</td>
        <td style="padding:12px 18px;font-size:13px;color:#1e293b;font-family:${FONT};text-align:right;white-space:nowrap;border-top:${i ? '1px solid #eef2f6' : 'none'}">${esc(money(it.subtotal, d.currency))}</td>
      </tr>`).join('')

  const totalsRows = (d.subtotal != null ? `
      <tr><td style="padding:5px 18px;font-size:12px;color:#64748b;font-family:${FONT};text-align:right;border-top:1px solid #eef2f6">Subtotal</td>
          <td style="padding:5px 18px;font-size:12px;color:#64748b;font-family:${FONT};text-align:right;white-space:nowrap;border-top:1px solid #eef2f6">${esc(money(d.subtotal, d.currency))}</td></tr>` : '')
    + (d.iva ? `
      <tr><td style="padding:5px 18px;font-size:12px;color:#64748b;font-family:${FONT};text-align:right">IVA</td>
          <td style="padding:5px 18px;font-size:12px;color:#64748b;font-family:${FONT};text-align:right;white-space:nowrap">${esc(money(d.iva, d.currency))}</td></tr>` : '')
    + `
      <tr><td style="padding:11px 18px;font-size:14px;font-weight:700;color:#0f172a;font-family:${FONT};text-align:right;border-top:2px solid #e2e8f0">Total</td>
          <td style="padding:11px 18px;font-size:15px;font-weight:700;color:#0f172a;font-family:${FONT};text-align:right;white-space:nowrap;border-top:2px solid #e2e8f0">${esc(money(d.amount, d.currency))}</td></tr>`

  const payBlock = d.payUrl ? `
    <tr><td style="padding:26px 28px 6px">
      <a href="${d.payUrl}" style="display:block;background:${accent};color:#ffffff;text-decoration:none;font-family:${FONT};font-weight:700;font-size:16px;text-align:center;padding:16px 0;border-radius:14px;box-shadow:0 6px 16px ${accent}33">Pagar ahora</a>
    </td></tr>
    <tr><td style="padding:8px 28px 0;text-align:center;font-size:11px;color:#94a3b8;font-family:${FONT}">
      Pago seguro con tarjeta. Si el botón no abre, copiá este link:<br/>
      <a href="${d.payUrl}" style="color:#94a3b8;word-break:break-all">${d.payUrl}</a>
    </td></tr>` : ''

  const instrBlock = (!d.payUrl && d.paymentInstructions) ? `
    <tr><td style="padding:20px 28px 0">
      <div style="background:#f8fafc;border-radius:12px;padding:14px 18px;font-size:12px;color:#475569;font-family:${FONT};line-height:1.7">
        <strong style="color:#0f172a;display:block;margin-bottom:4px">Datos para el pago</strong>${esc(d.paymentInstructions).replace(/\n/g, '<br/>')}
      </div>
    </td></tr>` : ''

  const logoChip = d.logoUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#ffffff;border-radius:12px;padding:8px 10px;line-height:0">
         <img src="${d.logoUrl}" alt="${esc(d.orgName)}" width="30" height="30" style="display:block;width:30px;height:30px;object-fit:contain;border-radius:6px" />
       </td></tr></table>`
    : ''

  const closing = d.hasPdf
    ? 'Te adjuntamos la factura en PDF. Cualquier consulta, respondé este correo.'
    : 'Cualquier consulta, respondé este correo.'

  return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
  @media only screen and (max-width:480px){
    .card{border-radius:0 !important}
    .pad{padding-left:20px !important;padding-right:20px !important}
    .amount{font-size:30px !important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#eef3f0;font-family:${FONT}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f0;padding:32px 10px">
    <tr><td align="center">
      <table role="presentation" class="card" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 10px 40px rgba(15,23,42,.10)">

        <tr><td style="background:linear-gradient(135deg,${accent},${accentDark});padding:26px 28px" class="pad">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle">${logoChip}</td>
            <td style="vertical-align:middle;text-align:right;color:#ffffff;font-family:${FONT};font-weight:700;font-size:17px;letter-spacing:.2px">${esc(d.orgName)}</td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:28px 28px 0" class="pad">
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;color:${accent};text-transform:uppercase;font-family:${FONT}">Factura ${esc(d.numero)}</p>
          ${d.empresaName ? `<p style="margin:6px 0 0;font-size:13px;color:#64748b;font-family:${FONT}">Para ${esc(d.empresaName)}</p>` : ''}
        </td></tr>

        <tr><td style="padding:18px 28px 0" class="pad">
          <p style="margin:0;font-size:12px;color:#94a3b8;font-family:${FONT};text-transform:uppercase;letter-spacing:1px">Total a pagar</p>
          <p class="amount" style="margin:4px 0 0;font-size:38px;font-weight:800;color:#0f172a;letter-spacing:-1px;font-family:${FONT}">${esc(money(d.amount, d.currency))}</p>
          <p style="margin:6px 0 0;font-size:12px;color:#94a3b8;font-family:${FONT}">Vence el ${esc(d.vence)}</p>
        </td></tr>

        <tr><td style="padding:22px 28px 0" class="pad">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6ebf0;border-radius:14px;overflow:hidden">
            <tr style="background:#f7f9fb">
              <td style="padding:10px 18px;font-size:10px;font-weight:700;letter-spacing:1px;color:#94a3b8;text-transform:uppercase;font-family:${FONT}">Concepto</td>
              <td style="padding:10px 18px;font-size:10px;font-weight:700;letter-spacing:1px;color:#94a3b8;text-transform:uppercase;text-align:right;font-family:${FONT}">Importe</td>
            </tr>
            ${itemRows}
            ${totalsRows}
          </table>
        </td></tr>

        ${payBlock}
        ${instrBlock}

        <tr><td style="padding:26px 28px 22px;font-size:12px;color:#94a3b8;line-height:1.7;font-family:${FONT}" class="pad">
          ${closing}<br/>
          — ${esc(d.orgName)}
        </td></tr>

        <tr><td style="padding:16px 28px;background:#f7f9fb;border-top:1px solid #eef2f6;text-align:center;font-size:11px;color:#b6c1cc;font-family:${FONT}">
          Enviado por ${esc(d.orgName)} · No responder a este correo
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
