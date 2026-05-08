import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const event = await prisma.event.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      include: {
        attendees: { orderBy: { createdAt: 'desc' } },
        _count: { select: { attendees: true } },
      },
    })

    if (!event) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
    return NextResponse.json({ data: event })
  } catch (error) {
    console.error('[EVENTO GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const existing = await prisma.event.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
    })
    if (!existing) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })

    const { name, description, eventDate, location, isActive } = await req.json()

    const event = await prisma.event.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(eventDate !== undefined && { eventDate: eventDate ? new Date(eventDate) : null }),
        ...(location !== undefined && { location: location || null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
      include: { _count: { select: { attendees: true } } },
    })

    return NextResponse.json({ data: event })
  } catch (error) {
    console.error('[EVENTO PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    await prisma.event.deleteMany({
      where: { id: params.id, organizationId: payload.orgId },
    })

    return NextResponse.json({ message: 'Evento eliminado' })
  } catch (error) {
    console.error('[EVENTO DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
