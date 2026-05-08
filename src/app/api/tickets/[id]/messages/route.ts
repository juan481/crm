import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const ticket = await prisma.ticket.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
    })
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })

    const { content, isInternal = false } = await req.json()
    if (!content?.trim()) return NextResponse.json({ error: 'El contenido es requerido' }, { status: 400 })

    const message = await prisma.ticketMessage.create({
      data: {
        ticketId: params.id,
        content: content.trim(),
        isInternal: Boolean(isInternal),
        userId: payload.userId,
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    })

    // Reopen if was waiting
    if (ticket.status === 'ESPERANDO') {
      await prisma.ticket.update({
        where: { id: params.id },
        data: { status: 'EN_PROCESO' },
      })
    }

    return NextResponse.json({ data: message }, { status: 201 })
  } catch (error) {
    console.error('[TICKET MSG POST]', error)
    return NextResponse.json({ error: 'Error al enviar mensaje' }, { status: 500 })
  }
}
