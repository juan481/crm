import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'
import { formatMoneyExact } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
      include: { empresa: { select: { id: true, name: true } } },
    })
    if (!inv) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })

    // Link de pago (Pagos & Portal) — se incluye en el mail sólo si la
    // factura tiene payToken y todavía no está pagada.
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
    const payUrl = inv.payToken && inv.status !== 'PAID' && appUrl
      ? `${appUrl}/pagar/${inv.payToken}`
      : null

    // El destino sale SIEMPRE de los contactos de la empresa de la factura —
    // no se acepta un email libre del body (evita usar el SMTP de la org como
    // relay). Si el body trae uno, tiene que coincidir con un contacto.
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
        name: true, crmName: true, primaryColor: true, secondaryColor: true,
        smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
        smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
      },
    })
    if (!org || !isOrgEmailConfigured(org)) {
      return NextResponse.json({ error: 'El email de la organización no está configurado (Configuración → Email SMTP).' }, { status: 400 })
    }

    const orgName = org.name || org.crmName || 'CRM'
    const numero = inv.numeroInterno ?? inv.id.slice(-8).toUpperCase()
    const accent = org.primaryColor || '#6366f1'
    const payButton = payUrl
      ? `\n\n<a href="${payUrl}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:10px;margin:8px 0">Pagar ahora</a>\n\nO copiá este link en el navegador:\n${payUrl}`
      : ''
    const html = buildEmailHtml(
      `Factura ${numero}`,
      `Adjuntamos la factura ${numero} por ${formatMoneyExact(inv.amount, inv.currency)}.\n\nVencimiento: ${new Date(inv.dueDate).toLocaleDateString('es-AR')}.${payButton}\n\nGracias,\n${orgName}`,
      orgName,
      accent,
      org.secondaryColor || '#8b5cf6',
    )
    const base64Data = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64

    await sendEmail({
      to: email,
      subject: `Factura ${numero} — ${orgName}`,
      html,
      smtpConfig: resolveOrgSmtpConfig(org),
      attachments: [{ filename: `factura-${numero}.pdf`, content: Buffer.from(base64Data, 'base64'), contentType: 'application/pdf' }],
    })

    await db.invoice.update({ where: { id: inv.id }, data: { sentAt: new Date() } })

    return NextResponse.json({ message: `Factura enviada a ${email}` })
  } catch (error) {
    console.error('[INVOICE ENVIAR]', error)
    return NextResponse.json({ error: 'Error al enviar la factura' }, { status: 500 })
  }
}
