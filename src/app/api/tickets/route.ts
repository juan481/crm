import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const INCLUDE = {
  client:     { select: { id: true, name: true } },
  empresa:    { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  createdBy:  { select: { id: true, name: true } },
  _count:     { select: { messages: true } },
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const search    = searchParams.get('search')    ?? ''
    const status    = searchParams.get('status')
    const priority  = searchParams.get('priority')
    const category  = searchParams.get('category')
    const clientId  = searchParams.get('clientId')
    const empresaId = searchParams.get('empresaId')
    const page  = Math.max(1, Number(searchParams.get('page')  ?? 1))
    const limit = Math.min(100, Number(searchParams.get('limit') ?? 50))
    const skip  = (page - 1) * limit

    const assignedToId = searchParams.get('assignedToId')

    const where: Record<string, unknown> = { organizationId: payload.orgId }
    if (payload.role === 'TECHNICIAN') {
      where.assignedToId = payload.userId
    } else if (assignedToId) {
      where.assignedToId = assignedToId
    }
    if (status)    where.status    = status
    if (priority)  where.priority  = priority
    if (category)  where.category  = category
    if (clientId)  where.clientId  = clientId
    if (empresaId) where.empresaId = empresaId
    if (search.length >= 2) {
      where.OR = [
        { title:       { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    const db = prisma as any
    const [tickets, total] = await Promise.all([
      db.ticket.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: INCLUDE }),
      db.ticket.count({ where }),
    ])

    return NextResponse.json({ data: tickets, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[TICKETS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { title, description, priority, category, clientId, empresaId, assignedToId } = await req.json()
    if (!title?.trim())       return NextResponse.json({ error: 'El título es requerido' },       { status: 400 })
    if (!description?.trim()) return NextResponse.json({ error: 'La descripción es requerida' },  { status: 400 })

    const db = prisma as any
    const ticketData = {
      title:          title.trim(),
      description:    description.trim(),
      priority:       priority    || 'MEDIA',
      category:       category    || 'SOPORTE',
      clientId:       clientId    || null,
      empresaId:      empresaId   || null,
      assignedToId:   assignedToId || null,
      createdById:    payload.userId,
      organizationId: payload.orgId,
    }

    // Retry on race condition (P2002 unique constraint on number+orgId)
    let ticket: any = null
    for (let attempt = 0; attempt < 5 && !ticket; attempt++) {
      const last = await db.ticket.findFirst({
        where:   { organizationId: payload.orgId },
        orderBy: { number: 'desc' },
        select:  { number: true },
      })
      try {
        ticket = await db.ticket.create({
          data: { ...ticketData, number: (last?.number ?? 0) + 1 },
          include: INCLUDE,
        })
      } catch (err: any) {
        if (err.code !== 'P2002' || attempt === 4) throw err
      }
    }

    return NextResponse.json({ data: ticket }, { status: 201 })
  } catch (error) {
    console.error('[TICKETS POST]', error)
    return NextResponse.json({ error: 'Error al crear ticket' }, { status: 500 })
  }
}
