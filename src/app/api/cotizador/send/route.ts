import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import type { QuoteItem } from '@/types'

const BILLING_LABELS: Record<string, string> = {
  MONTHLY:  'mes',
  ANNUAL:   'año',
  ONE_TIME: 'único',
}

function formatARS(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount)
}

function buildQuoteEmail(opts: {
  orgName: string
  primaryColor: string
  recipientName: string
  items: QuoteItem[]
  total: number
  currency: string
  notes?: string
  quoteRef: string
  agentName: string
}): string {
  const { orgName, primaryColor, recipientName, items, total, currency, notes, quoteRef, agentName } = opts
  const today = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

  const rows = items.map(item => `
    <tr>
      <td style="padding:12px 0;color:#1e293b;font-size:14px;border-bottom:1px solid #f1f5f9">
        ${item.name}${item.quantity > 1 ? ` <span style="color:#64748b">×${item.quantity}</span>` : ''}
      </td>
      <td style="padding:12px 0;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9;text-align:center">
        ${BILLING_LABELS[item.billingCycle] ?? 'mes'}
      </td>
      <td style="padding:12px 0;color:#1e293b;font-size:14px;font-weight:600;border-bottom:1px solid #f1f5f9;text-align:right">
        ${formatARS(item.price * item.quantity, item.currency)}
      </td>
    </tr>`).join('')

  const notesSection = notes
    ? `<div style="background:#f8fafc;border-left:3px solid ${primaryColor};border-radius:0 8px 8px 0;padding:14px 16px;margin:24px 0;font-size:13px;color:#475569;line-height:1.6">
        <strong style="color:#334155">Notas:</strong><br/>${notes}
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Presupuesto de Servicios — ${orgName}</title>
</head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;margin:0;padding:0">
  <div style="max-width:580px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,${primaryColor} 0%,#8b5cf6 100%);padding:36px 40px">
      <p style="color:rgba(255,255,255,0.75);font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px">Presupuesto de Servicios</p>
      <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px">${orgName}</h1>
      <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:13px">${today}</p>
    </div>
    <div style="padding:36px 40px">
      <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 20px">Ref: ${quoteRef}</p>
      <p style="font-size:15px;color:#1e293b;margin:0 0 6px;font-weight:500">Estimado/a <strong>${recipientName}</strong>,</p>
      <p style="font-size:14px;color:#64748b;margin:0 0 28px;line-height:1.6">
        A continuación encontrará el detalle de los servicios cotizados. Quedamos a su disposición ante cualquier consulta.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
        <thead>
          <tr>
            <th style="text-align:left;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;padding:0 0 10px;border-bottom:2px solid #e2e8f0;font-weight:600">Servicio</th>
            <th style="text-align:center;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;padding:0 0 10px;border-bottom:2px solid #e2e8f0;font-weight:600">Período</th>
            <th style="text-align:right;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;padding:0 0 10px;border-bottom:2px solid #e2e8f0;font-weight:600">Precio</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="padding:16px 0 4px;font-size:15px;font-weight:700;color:#1e293b">Total</td>
            <td style="padding:16px 0 4px;font-size:18px;font-weight:800;color:${primaryColor};text-align:right">${formatARS(total, currency)}</td>
          </tr>
        </tfoot>
      </table>
      ${notesSection}
      <p style="font-size:14px;color:#64748b;margin:24px 0 28px;line-height:1.6">
        Si desea avanzar con la contratación o tiene alguna pregunta, comuníquese con nosotros.
      </p>
      <div style="border-top:1px solid #e2e8f0;padding-top:20px;margin-top:8px">
        <p style="font-size:12px;color:#94a3b8;margin:0">
          Presupuesto preparado por <strong style="color:#64748b">${agentName}</strong> · ${orgName}
        </p>
      </div>
    </div>
    <div style="background:#f8fafc;padding:18px 40px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="font-size:12px;color:#94a3b8;margin:0">
        Este presupuesto es de carácter informativo y no constituye un contrato.
      </p>
    </div>
  </div>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { items, recipientEmail, recipientName, notes, total, currency, empresaId } = body as {
      items: QuoteItem[]
      empresaId?: string | null
      recipientEmail: string
      recipientName: string
      notes?: string
      total: number
      currency: string
    }

    if (!items?.length)  return NextResponse.json({ error: 'Sin servicios seleccionados' }, { status: 400 })
    if (!recipientEmail) return NextResponse.json({ error: 'Email destinatario requerido' },  { status: 400 })

    const db = prisma as any

    // Fetch org data
    const org = await prisma.organization.findUnique({
      where:  { id: payload.orgId },
      select: { name: true, crmName: true, primaryColor: true, logoUrl: true, smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true },
    })

    const agent = await prisma.user.findUnique({
      where:  { id: payload.userId },
      select: { name: true },
    })

    const orgName      = org?.crmName || org?.name || 'CRM'
    const primaryColor = org?.primaryColor || '#6366f1'
    const agentName    = agent?.name || 'El equipo'
    const quoteRef     = `PRESUP-${Date.now().toString(36).toUpperCase()}`

    // ── 1. Persist cotizacion to DB ──────────────────────────────────────────
    await db.cotizacion.create({
      data: {
        ref:           quoteRef,
        organizationId: payload.orgId,
        userId:        payload.userId,
        empresaId:     empresaId || null,
        recipientEmail,
        recipientName: recipientName || 'Cliente',
        items:         items as any,
        total,
        currency,
        notes:         notes || null,
        status:        'ENVIADA',
      },
    })

    // ── 2. Create EmpresaNota for the company timeline ───────────────────────
    if (empresaId) {
      const serviceNames = items.map(i => i.name).join(', ')
      const totalStr = new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(total)
      await db.empresaNota.create({
        data: {
          empresaId,
          organizationId: payload.orgId,
          userId:         payload.userId,
          tipo:           'NOTA',
          content:        `Cotización ${quoteRef} enviada a ${recipientName || recipientEmail} por ${agentName}. Total: ${totalStr} ${currency}. Servicios: ${serviceNames}.`,
        },
      })
    }

    // ── 3. Send email ────────────────────────────────────────────────────────
    const html = buildQuoteEmail({ orgName, primaryColor, recipientName: recipientName || 'Cliente', items, total, currency, notes, quoteRef, agentName })

    const smtpConfig = org?.smtpHost && org.smtpUser && org.smtpPass
      ? { host: org.smtpHost, port: org.smtpPort ?? 587, user: org.smtpUser, pass: org.smtpPass, from: org.smtpFrom || org.smtpUser }
      : undefined

    await sendEmail({ to: recipientEmail, subject: `Presupuesto de Servicios — ${orgName}`, html, smtpConfig })

    return NextResponse.json({
      message: 'Presupuesto enviado',
      ref:          quoteRef,
      orgName,
      primaryColor,
      logoUrl:      org?.logoUrl ?? null,
      agentName,
    })
  } catch (error) {
    console.error('[COTIZADOR SEND]', error)
    return NextResponse.json({ error: 'Error al enviar el presupuesto' }, { status: 500 })
  }
}
