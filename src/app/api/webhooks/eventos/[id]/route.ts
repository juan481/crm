import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const secret = req.nextUrl.searchParams.get('secret')

    const event = await prisma.event.findFirst({
      where: { id: params.id, isActive: true },
    })

    if (!event) {
      return NextResponse.json({ error: 'Evento no encontrado o inactivo' }, { status: 404 })
    }

    if (!secret || secret !== event.webhookSecret) {
      return NextResponse.json({ error: 'Secret inválido' }, { status: 401 })
    }

    const body = await req.json()
    const { firstName, lastName, company, phone, country, email } = body

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: 'firstName y lastName son requeridos' }, { status: 400 })
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
        source: 'webhook',
      },
    })

    return NextResponse.json({
      success: true,
      attendeeId: attendee.id,
      message: 'Inscrito registrado correctamente',
    })
  } catch (error) {
    console.error('[WEBHOOK EVENTO]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  return NextResponse.json({
    endpoint: `/api/webhooks/eventos/${params.id}?secret=YOUR_SECRET`,
    method: 'POST',
    body: {
      firstName: 'string (requerido)',
      lastName: 'string (requerido)',
      company: 'string (opcional)',
      phone: 'string (opcional)',
      country: 'string (opcional)',
      email: 'string (opcional)',
    },
  })
}
