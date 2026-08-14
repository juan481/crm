import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

// Same visibility as the task itself — mirrors comments/route.ts.
function scopeForTask(payload: { role: string; userId: string }, taskId: string, orgId: string) {
  const where: Record<string, unknown> = { id: taskId, organizationId: orgId }
  if (payload.role === 'TECHNICIAN') where.assignedToId = payload.userId
  else if (['SELLER', 'HR'].includes(payload.role)) where.OR = [{ assignedToId: payload.userId }, { createdById: payload.userId }]
  return where
}

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = prisma as any
    const task = await db.task.findFirst({ where: scopeForTask(payload, params.id, payload.orgId), select: { id: true } })
    if (!task) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })

    const subitems = await db.taskSubitem.findMany({
      where: { taskId: params.id },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json({ data: subitems })
  } catch (error) {
    console.error('[TASK SUBITEMS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = prisma as any
    const task = await db.task.findFirst({ where: scopeForTask(payload, params.id, payload.orgId), select: { id: true } })
    if (!task) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })

    const { title } = await req.json()
    if (!title?.trim()) return NextResponse.json({ error: 'El título es requerido' }, { status: 400 })

    const count = await db.taskSubitem.count({ where: { taskId: params.id } })
    const subitem = await db.taskSubitem.create({
      data: { taskId: params.id, title: title.trim(), order: count },
    })

    return NextResponse.json({ data: subitem }, { status: 201 })
  } catch (error) {
    console.error('[TASK SUBITEMS POST]', error)
    return NextResponse.json({ error: 'Error al crear subtarea' }, { status: 500 })
  }
}
