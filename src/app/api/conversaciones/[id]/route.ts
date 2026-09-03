import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canReplyToConversations } from '@/lib/whatsapp-bot/permissions'

export const dynamic = 'force-dynamic'

// collectedData tiene claves internas del engine (prefijo _) que no van al
// cliente — sólo los datos que juntó NISSI del cliente.
function publicCollectedData(cd: unknown): Record<string, unknown> | null {
  if (!cd || typeof cd !== 'object') return null
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(cd as Record<string, unknown>)) {
    if (!k.startsWith('_')) out[k] = v
  }
  return Object.keys(out).length ? out : null
}

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
        // Acotado a los últimos 500 mensajes (desc + reverse) — una charla
        // normal tiene decenas; esto sólo frena un caso patológico.
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 500,
          select: {
            id: true, role: true, content: true, createdAt: true, senderUserId: true,
            deliveryStatus: true,
            sender: { select: { id: true, name: true } },
          },
        },
      },
    })
    if (!conv) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    conv.messages.reverse()

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
    const canReply = await canReplyToConversations(payload.orgId, payload.role)

    return NextResponse.json({
      data: {
        id: conv.id,
        customerPhone: conv.customerPhone,
        customerName: conv.customerName,
        status: conv.status,
        humanHandling: !!conv.humanTakeoverAt,
        assignedUser: conv.assignedUser,
        handedOffTo: conv.handedOffTo,
        collectedData: publicCollectedData(conv.collectedData),
        canReply,
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
          author: m.role === 'user'
            ? 'cliente'
            : m.senderUserId
              ? (m.senderUserId === payload.userId ? 'vos' : m.sender?.name || 'un asesor')
              : 'NISSI',
          fromHuman: !!m.senderUserId,
          deliveryStatus: m.role === 'user' ? null : m.deliveryStatus ?? null,
        })),
      },
    })
  } catch (error) {
    console.error('[CONVERSACION GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
