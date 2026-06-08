import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const INCLUDE = {
  assignedTo: { select: { id: true, name: true } },
  createdBy:  { select: { id: true, name: true } },
  client:     { select: { id: true, name: true } },
  empresa:    { select: { id: true, name: true } },
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
    if (payload.role === 'SELLER') where.assignedToId = payload.userId
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

    const { title, description, priority, dueDate, assignedToId, clientId, empresaId } = await req.json()
    if (!title?.trim()) return NextResponse.json({ error: 'El título es requerido' }, { status: 400 })

    const db = prisma as any
    const task = await db.task.create({
      data: {
        title:          title.trim(),
        description:    description || null,
        priority:       priority    || 'MEDIA',
        dueDate:        dueDate ? new Date(dueDate) : null,
        assignedToId:   assignedToId || payload.userId,
        createdById:    payload.userId,
        clientId:       clientId  || null,
        empresaId:      empresaId || null,
        organizationId: payload.orgId,
      },
      include: INCLUDE,
    })

    return NextResponse.json({ data: task }, { status: 201 })
  } catch (error) {
    console.error('[TASKS POST]', error)
    return NextResponse.json({ error: 'Error al crear tarea' }, { status: 500 })
  }
}
