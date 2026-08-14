import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    // TECHNICIAN también, igual que GET/POST /api/eventos y GET
    // /api/eventos/[id] — antes esta ruta se había quedado en SELLER+ nada
    // más, así que un técnico que sí puede crear un evento se encontraba
    // con un 403 al intentar cargarle un inscrito manual desde el mismo
    // evento que acababa de crear.
    if (!canAccess(payload.role, 'SELLER') && payload.role !== 'TECHNICIAN')
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const event = await prisma.event.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
    })
    if (!event) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })

    const { firstName, lastName, company, phone, country, email } = await req.json()
    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: 'Nombre y apellido son requeridos' }, { status: 400 })
    }

    // Deduplicate by email
    if (email) {
      const existing = await prisma.eventAttendee.findFirst({
        where: { eventId: params.id, email: email.trim().toLowerCase() },
        select: { id: true },
      })
      if (existing) return NextResponse.json({ error: 'Este email ya está inscripto en el evento' }, { status: 409 })
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
    // TECHNICIAN también, igual que GET/POST /api/eventos y GET
    // /api/eventos/[id] — antes esta ruta se había quedado en SELLER+ nada
    // más, así que un técnico que sí puede crear un evento se encontraba
    // con un 403 al intentar cargarle un inscrito manual desde el mismo
    // evento que acababa de crear.
    if (!canAccess(payload.role, 'SELLER') && payload.role !== 'TECHNICIAN')
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { searchParams } = req.nextUrl
    const attendeeId = searchParams.get('attendeeId')
    if (!attendeeId) return NextResponse.json({ error: 'attendeeId requerido' }, { status: 400 })

    // Verify the event belongs to this org before deleting
    const event = await prisma.event.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true },
    })
    if (!event) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })

    await prisma.eventAttendee.deleteMany({
      where: { id: attendeeId, eventId: params.id },
    })

    return NextResponse.json({ message: 'Inscrito eliminado' })
  } catch (error) {
    console.error('[INSCRITO DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar inscrito' }, { status: 500 })
  }
}
