import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
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

    const db = prisma as any
    const existing = await db.task.findFirst({ where: { id: params.id, organizationId: payload.orgId } })
    if (!existing) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })

    const { title, description, status, priority, dueDate, assignedToId, clientId, empresaId, viewed } = await req.json()
    const isCompleting = status === 'HECHA' && existing.status !== 'HECHA'
    const shouldMarkViewed = viewed === true && payload.userId === existing.assignedToId && !existing.viewedAt

    const task = await db.task.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined       && { title }),
        ...(description !== undefined && { description: description || null }),
        ...(status !== undefined      && { status }),
        ...(priority                  && { priority }),
        ...(dueDate !== undefined     && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(assignedToId              && { assignedToId }),
        ...(clientId !== undefined    && { clientId:  clientId  || null }),
        ...(empresaId !== undefined   && { empresaId: empresaId || null }),
        ...(isCompleting              && { completedAt: new Date() }),
        ...(!isCompleting && status && status !== 'HECHA' && { completedAt: null }),
        ...(shouldMarkViewed          && { viewedAt: new Date() }),
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

    const db = prisma as any
    await db.task.deleteMany({ where: { id: params.id, organizationId: payload.orgId } })
    return NextResponse.json({ message: 'Tarea eliminada' })
  } catch (error) {
    console.error('[TASK DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
