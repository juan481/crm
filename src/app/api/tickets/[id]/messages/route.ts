import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'

interface Params { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (payload.role === 'HR') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    // Fetch ticket + client email (legacy fallback) for the client-notification email below
    const ticket = await prisma.ticket.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      include: {
        client: { select: { email: true, name: true } },
      },
    })
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })
    // A technician can only post on tickets assigned to them, same as PATCH.
    if (payload.role === 'TECHNICIAN' && ticket.assignedToId !== payload.userId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { content, isInternal = true, attachmentUrl, attachmentName } = await req.json()
    if (!content?.trim()) return NextResponse.json({ error: 'El contenido es requerido' }, { status: 400 })

    const message = await prisma.ticketMessage.create({
      data: {
        ticketId:   params.id,
        content:    content.trim(),
        isInternal: Boolean(isInternal),
        attachmentUrl:  attachmentUrl  || null,
        attachmentName: attachmentName || null,
        userId:     payload.userId,
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    })

    // Reopen if was waiting
    if (ticket.status === 'ESPERANDO') {
      await prisma.ticket.update({
        where: { id: params.id },
        data:  { status: 'EN_PROCESO' },
      })
    }

    // Notify the client by email when the note is marked "público" — uses
    // Ticket.recipientEmail (captured at creation) falling back to the
    // legacy Client's email for older, client-linked tickets.
    let emailNotified = false
    let emailError: string | null = null
    const toEmail = ticket.recipientEmail || ticket.client?.email
    if (!isInternal && toEmail) {
      const org = await prisma.organization.findUnique({
        where: { id: payload.orgId },
        select: {
          name: true, crmName: true, primaryColor: true, secondaryColor: true,
          smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
          smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
        },
      })

      if (isOrgEmailConfigured(org) || process.env.BREVO_API_KEY || process.env.SMTP_HOST) {
        try {
          const orgName = org?.name || org?.crmName || 'CRM'
          const recipientName = ticket.recipientName || ticket.client?.name || ''
          const ticketNumber = String(ticket.number).padStart(4, '0')
          const html = buildEmailHtml(
            `Actualización en tu ticket #${ticketNumber}`,
            `Hola${recipientName ? ' ' + recipientName : ''},\n\n${message.user.name} escribió una actualización sobre "${ticket.title}":\n\n${content.trim()}`,
            orgName,
            org?.primaryColor || '#6366f1',
            org?.secondaryColor || '#8b5cf6',
          )
          await sendEmail({
            to: toEmail,
            subject: `Actualización en tu ticket #${ticketNumber} — ${ticket.title}`,
            html,
            smtpConfig: resolveOrgSmtpConfig(org),
          })
          emailNotified = true
        } catch (err) {
          console.error('[TICKET MSG] Email notification failed:', err)
          emailError = 'No se pudo enviar el email al cliente'
        }
      } else {
        emailError = 'El cliente no recibió el email: falta configurar el correo en Configuración → Correo'
      }
    } else if (!isInternal && !toEmail) {
      emailError = 'El ticket no tiene un email de contacto cargado — el cliente no fue notificado'
    }

    return NextResponse.json({ data: message, emailNotified, emailError }, { status: 201 })
  } catch (error) {
    console.error('[TICKET MSG POST]', error)
    return NextResponse.json({ error: 'Error al guardar nota' }, { status: 500 })
  }
}
