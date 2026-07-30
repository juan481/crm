import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'
import { SLA_HOURS } from '@/lib/tickets'

interface Params { params: { id: string } }

const INCLUDE_DETAIL = {
  client:     { select: { id: true, name: true } },
  empresa:    { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  createdBy:  { select: { id: true, name: true } },
  messages: {
    orderBy: { createdAt: 'asc' as const },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  },
}

const INCLUDE_LIST = {
  client:     { select: { id: true, name: true } },
  empresa:    { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  createdBy:  { select: { id: true, name: true } },
  _count:     { select: { messages: true } },
}

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (payload.role === 'HR') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const ticket = await db.ticket.findFirst({ where: { id: params.id, organizationId: payload.orgId }, include: INCLUDE_DETAIL })
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })
    // A technician can only read tickets assigned to them, same as the list endpoint.
    if (payload.role === 'TECHNICIAN' && ticket.assignedToId !== payload.userId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }
    // satisfactionToken es el propio link público de calificación — nunca debe
    // viajar al staff (cualquiera con acceso al ticket podría auto-calificarlo).
    const { satisfactionToken, ...safeTicket } = ticket
    return NextResponse.json({ data: safeTicket })
  } catch (error) {
    console.error('[TICKET GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    // HR no puede editar tickets
    if (payload.role === 'HR')
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const existing = await db.ticket.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      include: { client: { select: { email: true, name: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })

    const body = await req.json()
    const { status } = body
    const isTech  = payload.role === 'TECHNICIAN'
    const isAdmin = canAccess(payload.role, 'ADMIN')

    // TECHNICIAN solo puede cambiar el estado de tickets asignados a ellos
    if (isTech && existing.assignedToId !== payload.userId)
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const isResolving = (status === 'RESUELTO' || status === 'CERRADO') &&
      existing.status !== 'RESUELTO' && existing.status !== 'CERRADO'

    const { title, priority, category, assignedToId, empresaId, clientId, recipientEmail, recipientName } = body

    // El SLA se recalcula si cambia la prioridad mientras el ticket sigue abierto.
    const priorityChanged = !isTech && priority && priority !== existing.priority
    const newSlaDueAt = (priorityChanged && !existing.resolvedAt)
      ? new Date(Date.now() + (SLA_HOURS[priority] ?? SLA_HOURS.MEDIA) * 60 * 60 * 1000)
      : undefined

    // Al cerrar/resolver, generamos (si falta) el token de calificación — se
    // emaila más abajo. Si el ticket se reabre y se vuelve a cerrar, se
    // limpia la calificación anterior para permitir una nueva por este ciclo
    // (si no, el guard de "ya calificado" del endpoint público bloquearía
    // la segunda invitación con el mismo token).
    const satisfactionToken = (isResolving && !existing.satisfactionToken)
      ? crypto.randomUUID()
      : undefined
    const resetSatisfaction = isResolving && !!existing.satisfactionRatedAt

    const ticket = await db.ticket.update({
      where: { id: params.id },
      data: {
        ...((!isTech && title)                 && { title }),
        ...(status !== undefined               && { status }),
        ...((!isTech && priority)              && { priority }),
        ...((!isTech && category)              && { category }),
        ...(isAdmin && assignedToId !== undefined && { assignedToId: assignedToId || null }),
        ...((!isTech && empresaId !== undefined)  && { empresaId: empresaId || null }),
        ...((!isTech && clientId !== undefined)   && { clientId: clientId || null }),
        ...((!isTech && recipientEmail !== undefined) && { recipientEmail: recipientEmail || null }),
        ...((!isTech && recipientName !== undefined)  && { recipientName: recipientName || null }),
        ...(isResolving                        && { resolvedAt: new Date() }),
        ...(newSlaDueAt                        && { slaDueAt: newSlaDueAt }),
        ...(satisfactionToken                  && { satisfactionToken }),
        ...(resetSatisfaction                  && { satisfactionRating: null, satisfactionComment: null, satisfactionRatedAt: null }),
      },
      include: INCLUDE_LIST,
    })

    // Invitar al contacto a calificar la atención — link público de un solo
    // uso, mismo patrón que Evento.webhookSecret. No requiere portal ni login.
    let satisfactionEmailSent = false
    if (isResolving) {
      const toEmail = existing.recipientEmail || existing.client?.email
      if (toEmail) {
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
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
            const ratingUrl = `${appUrl}/valorar-ticket/${ticket.satisfactionToken}`
            const orgName = org?.name || org?.crmName || 'CRM'
            const contactName = existing.recipientName || existing.client?.name || ''
            const ticketNumber = String(ticket.number).padStart(4, '0')
            const primaryColor = org?.primaryColor || '#6366f1'
            const html = buildEmailHtml(
              `¿Cómo fue tu experiencia con el ticket #${ticketNumber}?`,
              `Hola${contactName ? ' ' + contactName : ''},\n\nTu ticket "${ticket.title}" fue marcado como ${ticket.status === 'CERRADO' ? 'cerrado' : 'resuelto'}. Nos ayudaría mucho que nos cuentes cómo fue la atención recibida:\n\n<a href="${ratingUrl}" style="color:${primaryColor};font-weight:600">Calificar la atención →</a>`,
              orgName,
              primaryColor,
              org?.secondaryColor || '#8b5cf6',
            )
            await sendEmail({
              to: toEmail,
              subject: `¿Cómo fue tu experiencia? — Ticket #${ticketNumber}`,
              html,
              smtpConfig: resolveOrgSmtpConfig(org),
            })
            satisfactionEmailSent = true
          } catch (err) {
            console.error('[TICKET PATCH] Satisfaction email failed:', err)
          }
        }
      }
    }

    const { satisfactionToken: _token, ...safeTicket } = ticket
    return NextResponse.json({ data: safeTicket, satisfactionEmailSent })
  } catch (error) {
    console.error('[TICKET PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    await db.ticket.deleteMany({ where: { id: params.id, organizationId: payload.orgId } })
    return NextResponse.json({ message: 'Ticket eliminado' })
  } catch (error) {
    console.error('[TICKET DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
