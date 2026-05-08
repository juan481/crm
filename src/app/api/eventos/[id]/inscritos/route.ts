import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const event = await prisma.event.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
    })
    if (!event) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })

    const { firstName, lastName, company, phone, country, email } = await req.json()
    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: 'Nombre y apellido son requeridos' }, { status: 400 })
    }

    const attendee = await prisma.eventAttendee.create({
      data: {
        eventId: params.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        company: company || null,
        phone: phone || null,
        country: country || null,
        email: email || null,
        source: 'manual',
      },
    })

    return NextResponse.json({ data: attendee }, { status: 201 })
  } catch (error) {
    console.error('[INSCRITO POST]', error)
    return NextResponse.json({ error: 'Error al agregar inscrito' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const attendeeId = searchParams.get('attendeeId')
    if (!attendeeId) return NextResponse.json({ error: 'attendeeId requerido' }, { status: 400 })

    await prisma.eventAttendee.deleteMany({
      where: { id: attendeeId, eventId: params.id },
    })

    return NextResponse.json({ message: 'Inscrito eliminado' })
  } catch (error) {
    console.error('[INSCRITO DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar inscrito' }, { status: 500 })
  }
}
