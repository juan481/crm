import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

const INCLUDE_DETAIL = {
  client:     { select: { id: true, name: true } },
  empresa:    { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  createdBy:  { select: { id: true, name: true } },
  messages: {
    orderBy: { createdAt: 'asc' as const },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  },
}

const INCLUDE_LIST = {
  client:     { select: { id: true, name: true } },
  empresa:    { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  createdBy:  { select: { id: true, name: true } },
  _count:     { select: { messages: true } },
}

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = prisma as any
    const ticket = await db.ticket.findFirst({ where: { id: params.id, organizationId: payload.orgId }, include: INCLUDE_DETAIL })
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })
    return NextResponse.json({ data: ticket })
  } catch (error) {
    console.error('[TICKET GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = prisma as any
    const existing = await db.ticket.findFirst({ where: { id: params.id, organizationId: payload.orgId } })
    if (!existing) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })

    const { title, status, priority, category, assignedToId, empresaId, clientId } = await req.json()
    const isResolving = (status === 'RESUELTO' || status === 'CERRADO') && existing.status !== 'RESUELTO' && existing.status !== 'CERRADO'

    const ticket = await db.ticket.update({
      where: { id: params.id },
      data: {
        ...(title                     && { title }),
        ...(status !== undefined      && { status }),
        ...(priority                  && { priority }),
        ...(category                  && { category }),
        ...(assignedToId !== undefined && { assignedToId: assignedToId || null }),
        ...(empresaId !== undefined   && { empresaId: empresaId || null }),
        ...(clientId !== undefined    && { clientId: clientId || null }),
        ...(isResolving               && { resolvedAt: new Date() }),
      },
      include: INCLUDE_LIST,
    })

    return NextResponse.json({ data: ticket })
  } catch (error) {
    console.error('[TICKET PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    await db.ticket.deleteMany({ where: { id: params.id, organizationId: payload.orgId } })
    return NextResponse.json({ message: 'Ticket eliminado' })
  } catch (error) {
    console.error('[TICKET DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
