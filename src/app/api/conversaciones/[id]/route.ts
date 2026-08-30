import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const WINDOW_MS = 24 * 60 * 60 * 1000

// Hilo completo de una conversación de WhatsApp. Sin efectos secundarios —
// marcar como leída es POST .../read.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const conv = await db.whatsAppConversation.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: {
        id: true, customerPhone: true, customerName: true, status: true,
        humanTakeoverAt: true, handedOffTo: true, ticketId: true, dealId: true,
        collectedData: true, lastInboundAt: true,
        assignedUser: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, role: true, content: true, createdAt: true, senderUserId: true,
            sender: { select: { id: true, name: true } },
          },
        },
      },
    })
    if (!conv) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    const [deal, ticket] = await Promise.all([
      conv.dealId
        ? db.deal.findFirst({ where: { id: conv.dealId, organizationId: payload.orgId }, select: { id: true, title: true, stage: true, contacto: { select: { id: true, firstName: true, lastName: true } } } })
        : Promise.resolve(null),
      conv.ticketId
        ? db.ticket.findFirst({ where: { id: conv.ticketId, organizationId: payload.orgId }, select: { id: true, number: true, title: true, status: true, contacto: { select: { id: true, firstName: true, lastName: true } } } })
        : Promise.resolve(null),
    ])
    const contacto = deal?.contacto ?? ticket?.contacto ?? null

    const windowExpiresAt = conv.lastInboundAt ? new Date(new Date(conv.lastInboundAt).getTime() + WINDOW_MS) : null
    const windowOpen = !!windowExpiresAt && windowExpiresAt.getTime() > Date.now()

    return NextResponse.json({
      data: {
        id: conv.id,
        customerPhone: conv.customerPhone,
        customerName: conv.customerName,
        status: conv.status,
        humanHandling: !!conv.humanTakeoverAt,
        assignedUser: conv.assignedUser,
        handedOffTo: conv.handedOffTo,
        collectedData: conv.collectedData ?? null,
        windowOpen,
        windowExpiresAt,
        deal: deal ? { id: deal.id, title: deal.title, stage: deal.stage } : null,
        ticket: ticket ? { id: ticket.id, number: ticket.number, title: ticket.title, status: ticket.status } : null,
        contacto,
        messages: conv.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
          author: m.role === 'user' ? 'cliente' : m.sender?.name ? m.sender.name : 'NISSI',
          fromHuman: !!m.senderUserId,
        })),
      },
    })
  } catch (error) {
    console.error('[CONVERSACION GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
