import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Inbox de WhatsApp — lista de conversaciones de NISSI para la organización.
// Bandeja compartida: cualquier SELLER+ ve todas las conversaciones y puede
// responder desde el CRM (así Abba no necesita dar acceso a las herramientas
// de Meta). Ver también /api/conversaciones/[id] y .../reply|takeover|read.
export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { searchParams } = req.nextUrl
    // filtro: 'all' | 'nissi' (ACTIVE sin toma humana) | 'humano' (toma humana)
    //         | 'derivadas' (HANDED_OFF) | 'cerradas' (CLOSED)
    const filter = searchParams.get('filter') ?? 'all'
    const q = (searchParams.get('q') ?? '').trim()
    const unreadOnly = searchParams.get('unread') === '1'
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 30)))
    const skip = (page - 1) * limit

    const db = prisma as any
    const where: Record<string, unknown> = { organizationId: payload.orgId }
    if (filter === 'nissi') Object.assign(where, { status: 'ACTIVE', humanTakeoverAt: null })
    else if (filter === 'humano') where.humanTakeoverAt = { not: null }
    else if (filter === 'derivadas') where.status = 'HANDED_OFF'
    else if (filter === 'cerradas') where.status = 'CLOSED'
    if (q.length >= 2) {
      where.OR = [
        { customerPhone: { contains: q } },
        { customerName: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [rows, total] = await Promise.all([
      db.whatsAppConversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
        select: {
          id: true, customerPhone: true, customerName: true, status: true,
          humanTakeoverAt: true, handedOffTo: true, ticketId: true, dealId: true,
          lastMessageAt: true, lastInboundAt: true, lastReadAt: true,
          assignedUser: { select: { id: true, name: true } },
          contacto: { select: { id: true, firstName: true, lastName: true, empresa: { select: { id: true, name: true } } } },
          empresa: { select: { id: true, name: true } },
          messages: {
            orderBy: { createdAt: 'desc' }, take: 1,
            where: { role: { in: ['user', 'assistant'] } }, // el divisor 'system' no cuenta como "último mensaje"
            select: { content: true, role: true, senderUserId: true, deliveryStatus: true },
          },
        },
      }),
      db.whatsAppConversation.count({ where }),
    ])

    const data = rows
      .map((c: any) => {
        const unread = !!c.lastInboundAt && (!c.lastReadAt || new Date(c.lastReadAt) < new Date(c.lastInboundAt))
        const last = c.messages[0]
        const contactoNombre = c.contacto ? `${c.contacto.firstName} ${c.contacto.lastName}`.trim() : null
        // c.empresa es la fuente directa (asignación manual de sólo-empresa,
        // o denormalizada al vincular un contacto que tiene empresa); el
        // fallback a c.contacto.empresa cubre conversaciones vinculadas
        // antes de que existiera esa denormalización.
        const empresaNombre = c.empresa?.name ?? c.contacto?.empresa?.name ?? null
        return {
          id: c.id,
          customerPhone: c.customerPhone,
          customerName: c.customerName,
          // Prioridad para mostrar en la lista: persona vinculada > empresa
          // vinculada sola (charla B2B sin contacto puntual) > nombre de
          // WhatsApp > "No agendado" — nunca el número pelado si hay algo
          // mejor.
          displayName: contactoNombre || empresaNombre || c.customerName || null,
          // Subtítulo de empresa: sólo tiene sentido si el nombre principal
          // ya es una persona (si es la empresa sola, ya es el título).
          empresaNombre: contactoNombre ? empresaNombre : null,
          noAgendado: !contactoNombre && !empresaNombre && !c.customerName,
          status: c.status,
          humanHandling: !!c.humanTakeoverAt,
          assignedUser: c.assignedUser,
          handedOffTo: c.handedOffTo,
          ticketId: c.ticketId,
          dealId: c.dealId,
          lastMessageAt: c.lastMessageAt,
          unread,
          // El último mensaje saliente falló al enviarse → se marca en la lista.
          lastFailed: !!last && last.role !== 'user' && last.deliveryStatus === 'failed',
          preview: last
            ? `${last.role === 'user' ? '' : last.senderUserId ? '↩ ' : 'NISSI: '}${String(last.content).slice(0, 90)}`
            : '',
        }
      })
      .filter((c: any) => !unreadOnly || c.unread)

    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[CONVERSACIONES GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
