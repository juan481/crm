import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Fetch ticket + client email in a single query for the email TODO below
    const ticket = await prisma.ticket.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      include: {
        client: { select: { email: true, name: true } },
      },
    })
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })

    const { content, isInternal = true } = await req.json()
    if (!content?.trim()) return NextResponse.json({ error: 'El contenido es requerido' }, { status: 400 })

    const message = await prisma.ticketMessage.create({
      data: {
        ticketId:   params.id,
        content:    content.trim(),
        isInternal: Boolean(isInternal),
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

    // ─── TODO: Envío de email al cliente ──────────────────────────────────────
    // Cuando isInternal === false (nota marcada como "Pública"), enviar email
    // al cliente asociado al ticket con el contenido de la actualización.
    //
    // if (!isInternal && ticket.client?.email) {
    //   await sendTicketUpdateEmail({
    //     to:          ticket.client.email,
    //     clientName:  ticket.client.name,
    //     ticketNumber: String(ticket.number).padStart(4, '0'),
    //     ticketTitle: ticket.title,
    //     agentName:   message.user.name,
    //     content:     content.trim(),
    //   })
    // }
    //
    // Implementar con Resend (recomendado) o SendGrid:
    //   import { Resend } from 'resend'
    //   const resend = new Resend(process.env.RESEND_API_KEY)
    //   await resend.emails.send({ from: '...', to: ..., subject: ..., html: ... })
    // ─────────────────────────────────────────────────────────────────────────

    return NextResponse.json({ data: message }, { status: 201 })
  } catch (error) {
    console.error('[TICKET MSG POST]', error)
    return NextResponse.json({ error: 'Error al guardar nota' }, { status: 500 })
  }
}
