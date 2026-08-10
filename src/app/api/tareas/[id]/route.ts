import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { notifyTaskAssignment } from '@/lib/task-notifications'

interface Params { params: { id: string } }

const INCLUDE = {
  assignedTo: { select: { id: true, name: true } },
  createdBy:  { select: { id: true, name: true } },
  client:     { select: { id: true, name: true } },
  empresa:    { select: { id: true, name: true } },
  deal:       { select: { id: true, title: true } },
  ticket:     { select: { id: true, number: true, title: true } },
}

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = prisma as any
    // Same visibility as the list endpoint — a lower role could otherwise
    // read any task in the org by guessing/typing its id, even though the
    // list itself already scopes them to their own.
    const scopeWhere: Record<string, unknown> = { id: params.id, organizationId: payload.orgId }
    if (payload.role === 'TECHNICIAN') scopeWhere.assignedToId = payload.userId
    else if (['SELLER', 'HR'].includes(payload.role)) scopeWhere.OR = [{ assignedToId: payload.userId }, { createdById: payload.userId }]

    const task = await db.task.findFirst({ where: scopeWhere, include: INCLUDE })
    if (!task) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })
    return NextResponse.json({ data: task })
  } catch (error) {
    console.error('[TASK GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    // HR solo puede ver tareas, no editarlas
    if (payload.role === 'HR')
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const scopeWhere: Record<string, unknown> = { id: params.id, organizationId: payload.orgId }
    if (payload.role === 'SELLER') scopeWhere.OR = [{ assignedToId: payload.userId }, { createdById: payload.userId }]
    const existing = await db.task.findFirst({ where: scopeWhere })
    if (!existing) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })

    const body = await req.json()
    const { status, viewed } = body
    const isTech = payload.role === 'TECHNICIAN'

    // TECHNICIAN solo puede marcar como vista o cambiar estado de sus propias tareas
    if (isTech && existing.assignedToId !== payload.userId)
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { title, description, priority, dueDate, assignedToId, clientId, empresaId, dealId, ticketId } = body
    const isCompleting    = status === 'HECHA' && existing.status !== 'HECHA'
    const shouldMarkViewed = viewed === true && payload.userId === existing.assignedToId && !existing.viewedAt
    const isReassigning = !isTech && assignedToId && assignedToId !== existing.assignedToId

    // Mismo chequeo que ya hace POST /api/tareas — faltaba acá en el PATCH.
    if (!isTech && assignedToId && assignedToId !== existing.assignedToId) {
      const assignee = await db.user.findFirst({ where: { id: assignedToId, organizationId: payload.orgId }, select: { id: true } })
      if (!assignee) return NextResponse.json({ error: 'Usuario no encontrado en esta organización' }, { status: 400 })
    }
    if (!isTech && clientId) {
      const client = await db.client.findFirst({ where: { id: clientId, organizationId: payload.orgId }, select: { id: true } })
      if (!client) return NextResponse.json({ error: 'Cliente no encontrado en esta organización' }, { status: 400 })
    }
    if (!isTech && empresaId) {
      const empresa = await db.empresa.findFirst({ where: { id: empresaId, organizationId: payload.orgId }, select: { id: true } })
      if (!empresa) return NextResponse.json({ error: 'Empresa no encontrada en esta organización' }, { status: 400 })
    }
    if (!isTech && dealId) {
      const deal = await db.deal.findFirst({ where: { id: dealId, organizationId: payload.orgId }, select: { id: true } })
      if (!deal) return NextResponse.json({ error: 'Oportunidad no encontrada en esta organización' }, { status: 400 })
    }
    if (!isTech && ticketId) {
      const ticket = await db.ticket.findFirst({ where: { id: ticketId, organizationId: payload.orgId }, select: { id: true } })
      if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado en esta organización' }, { status: 400 })
    }

    const task = await db.task.update({
      where: { id: params.id },
      data: {
        ...((!isTech && title !== undefined)       && { title }),
        ...((!isTech && description !== undefined) && { description: description || null }),
        ...(status !== undefined                   && { status }),
        ...((!isTech && priority)                  && { priority }),
        ...((!isTech && dueDate !== undefined)     && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...((!isTech && assignedToId)              && { assignedToId }),
        ...((!isTech && clientId !== undefined)    && { clientId:  clientId  || null }),
        ...((!isTech && empresaId !== undefined)   && { empresaId: empresaId || null }),
        ...((!isTech && dealId !== undefined)      && { dealId:   dealId   || null }),
        ...((!isTech && ticketId !== undefined)    && { ticketId: ticketId || null }),
        ...(isCompleting                           && { completedAt: new Date() }),
        ...(!isCompleting && status && status !== 'HECHA' && { completedAt: null }),
        ...(shouldMarkViewed                       && { viewedAt: new Date() }),
      },
      include: INCLUDE,
    })

    // Email al nuevo asignado — sólo cuando de verdad cambia a otra persona
    // (no cuando se re-guarda la misma), y nunca cuando uno se autoasigna.
    if (isReassigning && assignedToId !== payload.userId) {
      notifyTaskAssignment(task, payload.orgId)
    }

    return NextResponse.json({ data: task })
  } catch (error) {
    console.error('[TASK PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN'))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    await db.task.deleteMany({ where: { id: params.id, organizationId: payload.orgId } })
    return NextResponse.json({ message: 'Tarea eliminada' })
  } catch (error) {
    console.error('[TASK DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
