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

    let email: string | null = typeof body?.email === 'string' && body.email.includes('@') ? body.email.trim() : null
    if (!email && inv.empresaId) {
      const c = await db.directorioContacto.findFirst({
        where: { organizationId: payload.orgId, empresaId: inv.empresaId, email: { not: null } },
        select: { email: true },
      })
      email = c?.email ?? null
    }
    if (!email) return NextResponse.json({ error: 'No hay un email de destino. Cargá un contacto con mail en la empresa o indicá uno.' }, { status: 400 })

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
    const html = buildEmailHtml(
      `Factura ${numero}`,
      `Adjuntamos la factura ${numero} por ${formatMoneyExact(inv.amount, inv.currency)}.\n\nVencimiento: ${new Date(inv.dueDate).toLocaleDateString('es-AR')}.\n\nGracias,\n${orgName}`,
      orgName,
      org.primaryColor || '#6366f1',
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
