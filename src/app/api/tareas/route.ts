import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const status = searchParams.get('status')
    const assignedToId = searchParams.get('assignedToId')
    const clientId = searchParams.get('clientId')

    const where: Record<string, unknown> = { organizationId: payload.orgId }
    if (status) where.status = status
    if (assignedToId) where.assignedToId = assignedToId
    if (clientId) where.clientId = clientId
    if (payload.role === 'SELLER') where.assignedToId = payload.userId

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ data: tasks })
  } catch (error) {
    console.error('[TASKS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { title, description, priority, dueDate, assignedToId, clientId } = await req.json()
    if (!title?.trim()) return NextResponse.json({ error: 'El título es requerido' }, { status: 400 })

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description || null,
        priority: priority || 'MEDIA',
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedToId: assignedToId || payload.userId,
        createdById: payload.userId,
        clientId: clientId || null,
        organizationId: payload.orgId,
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ data: task }, { status: 201 })
  } catch (error) {
    console.error('[TASKS POST]', error)
    return NextResponse.json({ error: 'Error al crear tarea' }, { status: 500 })
  }
}
