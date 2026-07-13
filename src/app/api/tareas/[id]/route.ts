import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

const INCLUDE = {
  assignedTo: { select: { id: true, name: true } },
  createdBy:  { select: { id: true, name: true } },
  client:     { select: { id: true, name: true } },
  empresa:    { select: { id: true, name: true } },
}

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = prisma as any
    const task = await db.task.findFirst({ where: { id: params.id, organizationId: payload.orgId }, include: INCLUDE })
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
    const existing = await db.task.findFirst({ where: { id: params.id, organizationId: payload.orgId } })
    if (!existing) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })

    const body = await req.json()
    const { status, viewed } = body
    const isTech = payload.role === 'TECHNICIAN'

    // TECHNICIAN solo puede marcar como vista o cambiar estado de sus propias tareas
    if (isTech && existing.assignedToId !== payload.userId)
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { title, description, priority, dueDate, assignedToId, clientId, empresaId } = body
    const isCompleting    = status === 'HECHA' && existing.status !== 'HECHA'
    const shouldMarkViewed = viewed === true && payload.userId === existing.assignedToId && !existing.viewedAt

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
        ...(isCompleting                           && { completedAt: new Date() }),
        ...(!isCompleting && status && status !== 'HECHA' && { completedAt: null }),
        ...(shouldMarkViewed                       && { viewedAt: new Date() }),
      },
      include: INCLUDE,
    })

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
