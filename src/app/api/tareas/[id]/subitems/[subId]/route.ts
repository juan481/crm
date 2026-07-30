import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string; subId: string } }

function scopeForTask(payload: { role: string; userId: string }, taskId: string, orgId: string) {
  const where: Record<string, unknown> = { id: taskId, organizationId: orgId }
  if (payload.role === 'TECHNICIAN') where.assignedToId = payload.userId
  else if (['SELLER', 'HR'].includes(payload.role)) where.OR = [{ assignedToId: payload.userId }, { createdById: payload.userId }]
  return where
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = prisma as any
    const task = await db.task.findFirst({ where: scopeForTask(payload, params.id, payload.orgId) })
    if (!task) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })

    const { title, done } = await req.json()
    const subitem = await db.taskSubitem.update({
      where: { id: params.subId },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(done !== undefined && { done: Boolean(done) }),
      },
    })

    return NextResponse.json({ data: subitem })
  } catch (error) {
    console.error('[TASK SUBITEM PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = prisma as any
    const task = await db.task.findFirst({ where: scopeForTask(payload, params.id, payload.orgId) })
    if (!task) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })

    await db.taskSubitem.deleteMany({ where: { id: params.subId, taskId: params.id } })
    return NextResponse.json({ message: 'Subtarea eliminada' })
  } catch (error) {
    console.error('[TASK SUBITEM DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
