import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const category = searchParams.get('category')
    const clientId = searchParams.get('clientId')

    const where: Record<string, unknown> = { organizationId: payload.orgId }
    if (status) where.status = status
    if (priority) where.priority = priority
    if (category) where.category = category
    if (clientId) where.clientId = clientId

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
    })

    return NextResponse.json({ data: tickets })
  } catch (error) {
    console.error('[TICKETS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { title, description, priority, category, clientId, assignedToId } = await req.json()
    if (!title?.trim()) return NextResponse.json({ error: 'El título es requerido' }, { status: 400 })
    if (!description?.trim()) return NextResponse.json({ error: 'La descripción es requerida' }, { status: 400 })

    // Auto-increment ticket number per org
    const lastTicket = await prisma.ticket.findFirst({
      where: { organizationId: payload.orgId },
      orderBy: { number: 'desc' },
      select: { number: true },
    })
    const number = (lastTicket?.number ?? 0) + 1

    const ticket = await prisma.ticket.create({
      data: {
        number,
        title: title.trim(),
        description: description.trim(),
        priority: priority || 'MEDIA',
        category: category || 'SOPORTE',
        clientId: clientId || null,
        assignedToId: assignedToId || null,
        createdById: payload.userId,
        organizationId: payload.orgId,
      },
      include: {
        client: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
    })

    return NextResponse.json({ data: ticket }, { status: 201 })
  } catch (error) {
    console.error('[TICKETS POST]', error)
    return NextResponse.json({ error: 'Error al crear ticket' }, { status: 500 })
  }
}
