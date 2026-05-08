import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(_: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const events = await prisma.event.findMany({
      where: { organizationId: payload.orgId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { attendees: true } } },
    })

    return NextResponse.json({ data: events })
  } catch (error) {
    console.error('[EVENTOS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { name, description, eventDate, location } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

    const event = await prisma.event.create({
      data: {
        name: name.trim(),
        description: description || null,
        eventDate: eventDate ? new Date(eventDate) : null,
        location: location || null,
        organizationId: payload.orgId,
      },
      include: { _count: { select: { attendees: true } } },
    })

    return NextResponse.json({ data: event }, { status: 201 })
  } catch (error) {
    console.error('[EVENTOS POST]', error)
    return NextResponse.json({ error: 'Error al crear evento' }, { status: 500 })
  }
}
