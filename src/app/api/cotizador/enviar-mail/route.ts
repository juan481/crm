import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendEmail, resolveOrgSmtpConfig } from '@/lib/email'
import type { QuoteItem } from '@/types'

export const dynamic = 'force-dynamic'

const BILLING_LABELS: Record<string, string> = {
  MONTHLY:  'mes',
  ANNUAL:   'año',
  ONE_TIME: 'único',
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount)
}

function buildQuoteHtml(opts: {
  orgName: string; primaryColor: string; recipientName: string
  items: QuoteItem[]; total: number; discount?: number; finalTotal?: number; currency: string
  notes?: string; quoteRef: string; agentName: string
}): string {
  const { orgName, primaryColor, recipientName, items, total, discount = 0, finalTotal, currency, notes, quoteRef, agentName } = opts
  const displayTotal = finalTotal ?? total
  const today = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

  const rows = items.map(item => `
    <tr>
      <td style="padding:12px 0;color:#1e293b;font-size:14px;border-bottom:1px solid #f1f5f9">
        ${item.name}${item.quantity > 1 ? ` <span style="color:#64748b">×${item.quantity}</span>` : ''}
      </td>
      <td style="padding:12px 0;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9;text-align:center">
        ${BILLING_LABELS[item.billingCycle ?? ''] ?? (item.unit ?? 'mes')}
      </td>
      <td style="padding:12px 0;color:#1e293b;font-size:14px;font-weight:600;border-bottom:1px solid #f1f5f9;text-align:right">
        ${formatMoney(item.price * item.quantity, item.currency)}
      </td>
    </tr>`).join('')

  const notesSection = notes
    ? `<div style="background:#f8fafc;border-left:3px solid ${primaryColor};border-radius:0 8px 8px 0;padding:14px 16px;margin:24px 0;font-size:13px;color:#475569;line-height:1.6">
        <strong style="color:#334155">Notas:</strong><br/>${notes}
       </div>`
    : ''

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;margin:0;padding:0">
  <div style="max-width:580px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,${primaryColor} 0%,#8b5cf6 100%);padding:36px 40px">
      <p style="color:rgba(255,255,255,.75);font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px">Presupuesto de Servicios</p>
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700">${orgName}</h1>
      <p style="color:rgba(255,255,255,.75);margin:6px 0 0;font-size:13px">${today}</p>
    </div>
    <div style="padding:36px 40px">
      <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 20px">Ref: ${quoteRef}</p>
      <p style="font-size:15px;color:#1e293b;margin:0 0 6px;font-weight:500">Estimado/a <strong>${recipientName}</strong>,</p>
      <p style="font-size:14px;color:#64748b;margin:0 0 28px;line-height:1.6">A continuación encontrará el detalle de los servicios cotizados. Quedamos a su disposición.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
        <thead>
          <tr>
            <th style="text-align:left;font-size:11px;color:#94a3b8;text-transform:uppercase;padding:0 0 10px;border-bottom:2px solid #e2e8f0">Servicio</th>
            <th style="text-align:center;font-size:11px;color:#94a3b8;text-transform:uppercase;padding:0 0 10px;border-bottom:2px solid #e2e8f0">Período</th>
            <th style="text-align:right;font-size:11px;color:#94a3b8;text-transform:uppercase;padding:0 0 10px;border-bottom:2px solid #e2e8f0">Precio</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          ${discount > 0 ? `
          <tr>
            <td colspan="2" style="padding:8px 0 4px;font-size:13px;color:#64748b">Subtotal</td>
            <td style="padding:8px 0 4px;font-size:13px;color:#64748b;text-align:right">${formatMoney(total, currency)}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding:4px 0;font-size:13px;color:#10b981">Descuento (${discount}%)</td>
            <td style="padding:4px 0;font-size:13px;color:#10b981;text-align:right">− ${formatMoney(total * discount / 100, currency)}</td>
          </tr>` : ''}
          <tr>
            <td colspan="2" style="padding:${discount > 0 ? '8' : '16'}px 0 4px;font-size:15px;font-weight:700;color:#1e293b;border-top:${discount > 0 ? '2px solid #e2e8f0' : 'none'}">Total</td>
            <td style="padding:${discount > 0 ? '8' : '16'}px 0 4px;font-size:18px;font-weight:800;color:${primaryColor};text-align:right;border-top:${discount > 0 ? '2px solid #e2e8f0' : 'none'}">${formatMoney(displayTotal, currency)}</td>
          </tr>
        </tfoot>
      </table>
      ${notesSection}
      <div style="border-top:1px solid #e2e8f0;padding-top:20px;margin-top:24px">
        <p style="font-size:12px;color:#94a3b8;margin:0">
          Presupuesto preparado por <strong style="color:#64748b">${agentName}</strong> · ${orgName}
        </p>
      </div>
    </div>
    <div style="background:#f8fafc;padding:18px 40px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="font-size:12px;color:#94a3b8;margin:0">Este presupuesto es de carácter informativo y no constituye un contrato.</p>
    </div>
  </div>
</body></html>`
}

// POST /api/cotizador/enviar-mail
// Sends the saved cotizacion by email with the PDF as attachment.
// Body: { cotizacionId: string, pdfBase64: string }
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN', 'SELLER'].includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { cotizacionId, pdfBase64 } = await req.json()
    if (!cotizacionId) return NextResponse.json({ error: 'cotizacionId requerido' }, { status: 400 })
    if (!pdfBase64)    return NextResponse.json({ error: 'PDF requerido' },           { status: 400 })

    const db = prisma as any

    const cotizacion = await db.cotizacion.findFirst({
      where: { id: cotizacionId, organizationId: payload.orgId },
    })
    if (!cotizacion) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })

    const [org, agent] = await Promise.all([
      prisma.organization.findUnique({
        where:  { id: payload.orgId },
        select: {
          name: true, crmName: true, primaryColor: true,
          smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
          smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
        },
      }),
      prisma.user.findUnique({
        where:  { id: payload.userId },
        select: { name: true },
      }),
    ])

    const orgName      = org?.name || org?.crmName || 'CRM Pro'
    const primaryColor = org?.primaryColor || '#6366f1'
    const agentName    = agent?.name || 'El equipo'

    const html = buildQuoteHtml({
      orgName, primaryColor,
      recipientName: cotizacion.recipientName,
      items:         cotizacion.items as QuoteItem[],
      total:         cotizacion.total,
      discount:      cotizacion.discount ?? 0,
      finalTotal:    cotizacion.finalTotal ?? cotizacion.total,
      currency:      cotizacion.currency,
      notes:         cotizacion.notes ?? undefined,
      quoteRef:      cotizacion.ref,
      agentName,
    })

    const smtpConfig = resolveOrgSmtpConfig(org)

    // Strip the data URI prefix if present (data:application/pdf;base64,...)
    const base64Data = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64
    const pdfBuffer  = Buffer.from(base64Data, 'base64')

    await sendEmail({
      to:      cotizacion.recipientEmail,
      subject: `Presupuesto de Servicios — ${orgName} (${cotizacion.ref})`,
      html,
      smtpConfig,
      attachments: [{
        filename:    `${cotizacion.ref}.pdf`,
        content:     pdfBuffer,
        contentType: 'application/pdf',
      }],
    })

    // Mark as ENVIADA
    await db.cotizacion.update({
      where: { id: cotizacionId },
      data:  { status: 'ENVIADA' },
    })

    return NextResponse.json({ message: 'Email enviado con el presupuesto adjunto' })
  } catch (error) {
    console.error('[COTIZADOR ENVIAR-MAIL]', error)
    const msg = (error as Error).message ?? 'Error al enviar el email'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
