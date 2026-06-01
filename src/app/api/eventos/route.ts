import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(50, Number(searchParams.get('limit') ?? 20))
    const skip = (page - 1) * limit

    const where = { organizationId: payload.orgId }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { attendees: true } } },
      }),
      prisma.event.count({ where }),
    ])

    return NextResponse.json({ data: events, total, page, limit, totalPages: Math.ceil(total / limit) })
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
