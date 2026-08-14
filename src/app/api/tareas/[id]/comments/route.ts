import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

// Same visibility as the task itself: ADMIN+ unrestricted, everyone else
// only on tasks assigned to them (or, for SELLER/HR, that they created).
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

    const comments = await db.taskComment.findMany({
      where: { taskId: params.id },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    })

    return NextResponse.json({ data: comments })
  } catch (error) {
    console.error('[TASK COMMENTS GET]', error)
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

    const { content, attachmentUrl, attachmentName } = await req.json()
    if (!content?.trim() && !attachmentUrl) {
      return NextResponse.json({ error: 'Escribí algo o adjuntá un archivo' }, { status: 400 })
    }

    const comment = await db.taskComment.create({
      data: {
        taskId: params.id,
        content: content?.trim() || '',
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
        userId: payload.userId,
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    })

    return NextResponse.json({ data: comment }, { status: 201 })
  } catch (error) {
    console.error('[TASK COMMENTS POST]', error)
    return NextResponse.json({ error: 'Error al comentar' }, { status: 500 })
  }
}
