import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { notifyTaskAssignment } from '@/lib/task-notifications'

export const dynamic = 'force-dynamic'

const INCLUDE = {
  assignedTo: { select: { id: true, name: true } },
  createdBy:  { select: { id: true, name: true } },
  client:     { select: { id: true, name: true } },
  empresa:    { select: { id: true, name: true } },
  deal:       { select: { id: true, title: true } },
  ticket:     { select: { id: true, number: true, title: true } },
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const search       = searchParams.get('search')       ?? ''
    const status       = searchParams.get('status')
    const assignedToId = searchParams.get('assignedToId')
    const empresaId    = searchParams.get('empresaId')
    const page  = Math.max(1, Number(searchParams.get('page')  ?? 1))
    const limit = Math.min(200, Number(searchParams.get('limit') ?? 50))
    const skip  = (page - 1) * limit

    const where: Record<string, unknown> = { organizationId: payload.orgId }
    if (status)       where.status       = status
    if (assignedToId) where.assignedToId = assignedToId
    if (empresaId)    where.empresaId    = empresaId
    if (['SELLER', 'TECHNICIAN', 'HR'].includes(payload.role)) where.assignedToId = payload.userId
    if (search.length >= 2) {
      where.OR = [
        { title:       { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    const db = prisma as any
    const [tasks, total] = await Promise.all([
      db.task.findMany({ where, skip, take: limit, orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }], include: INCLUDE }),
      db.task.count({ where }),
    ])

    return NextResponse.json({ data: tasks, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[TASKS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { title, description, priority, dueDate, assignedToId, clientId, empresaId, dealId, ticketId } = await req.json()
    if (!title?.trim()) return NextResponse.json({ error: 'El título es requerido' }, { status: 400 })

    const db = prisma as any
    const finalAssignedToId = assignedToId || payload.userId

    // Sin esto, cualquiera de estos ids podía ser de OTRA organización — el
    // FK de Prisma sólo exige que exista en algún lado, no que sea de esta
    // org. La tarea quedaba vinculada a un registro ajeno, y su nombre
    // terminaba expuesto acá mismo (vía el include de abajo) o, en el caso
    // de assignedToId, se le mandaba el mail de "tarea asignada" a alguien
    // de otra empresa por completo.
    // Las 5 validaciones son independientes entre sí — van en paralelo. Antes
    // eran hasta 5 round-trips secuenciales en la creación de UNA tarea, cada
    // uno pagando el costo completo de ida y vuelta a la base uno atrás del
    // otro (ver investigación de performance: el costo real está en la
    // CANTIDAD de round-trips, no en la complejidad de cada query).
    const [assignee, client, empresa, deal, ticket] = await Promise.all([
      (finalAssignedToId !== payload.userId) ? db.user.findFirst({ where: { id: finalAssignedToId, organizationId: payload.orgId }, select: { id: true } }) : null,
      clientId  ? db.client.findFirst({ where: { id: clientId, organizationId: payload.orgId }, select: { id: true } })  : null,
      empresaId ? db.empresa.findFirst({ where: { id: empresaId, organizationId: payload.orgId }, select: { id: true } }) : null,
      dealId    ? db.deal.findFirst({ where: { id: dealId, organizationId: payload.orgId }, select: { id: true } })      : null,
      ticketId  ? db.ticket.findFirst({ where: { id: ticketId, organizationId: payload.orgId }, select: { id: true } })  : null,
    ])
    if (finalAssignedToId !== payload.userId && !assignee) return NextResponse.json({ error: 'Usuario no encontrado en esta organización' }, { status: 400 })
    if (clientId && !client)   return NextResponse.json({ error: 'Cliente no encontrado en esta organización' }, { status: 400 })
    if (empresaId && !empresa) return NextResponse.json({ error: 'Empresa no encontrada en esta organización' }, { status: 400 })
    if (dealId && !deal)       return NextResponse.json({ error: 'Oportunidad no encontrada en esta organización' }, { status: 400 })
    if (ticketId && !ticket)   return NextResponse.json({ error: 'Ticket no encontrado en esta organización' }, { status: 400 })

    const task = await db.task.create({
      data: {
        title:          title.trim(),
        description:    description || null,
        priority:       priority    || 'MEDIA',
        dueDate:        dueDate ? new Date(dueDate) : null,
        assignedToId:   finalAssignedToId,
        createdById:    payload.userId,
        clientId:       clientId  || null,
        empresaId:      empresaId || null,
        dealId:         dealId    || null,
        ticketId:       ticketId  || null,
        organizationId: payload.orgId,
      },
      include: INCLUDE,
    })

    // Email al asignado — sólo si se la asignaron a otra persona (no a uno
    // mismo) y la org tiene correo configurado. Best-effort: si falla, la
    // tarea ya se creó igual, no se revierte nada por esto.
    if (finalAssignedToId !== payload.userId) {
      notifyTaskAssignment(task, payload.orgId)
    }

    return NextResponse.json({ data: task }, { status: 201 })
  } catch (error) {
    console.error('[TASKS POST]', error)
    return NextResponse.json({ error: 'Error al crear tarea' }, { status: 500 })
  }
}
