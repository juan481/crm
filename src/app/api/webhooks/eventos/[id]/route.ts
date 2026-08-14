import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'

interface Params { params: { id: string } }

// Mismo criterio que /api/public/tickets/[token] (que sí lo tenía y este no)
// — el webhookSecret es impredecible (cuid), pero está pensado para vivir
// pegado en la config de un form externo (WordPress/Zapier/Make, ver el GET
// de abajo), así que es realista que termine logueado/filtrado ahí. Sin
// límite, alguien con el secret podía crear EventAttendee sin tope (es
// idempotente por email, así que alcanza con variar el email para saltear
// esa protección). Ventana generosa para no frenar un evento real con
// mucho tráfico legítimo.
const RATE_LIMIT = { max: 30, windowMinutes: 10 }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const ip = getClientIp(req)
    const { limited } = await checkRateLimit('event_webhook', `${params.id}:${ip}`, RATE_LIMIT)
    if (limited) {
      return NextResponse.json({ error: 'Demasiados intentos — probá de nuevo en un rato.' }, { status: 429 })
    }

    // Accept secret from Authorization header (Bearer) or legacy query param
    const authHeader = req.headers.get('authorization') ?? ''
    const secret = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.nextUrl.searchParams.get('secret')

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

    // Idempotente por email — un reintento de red del form externo (WordPress,
    // SNS-style retry) no debe crear un inscrito duplicado. A diferencia del
    // alta manual (que sí es un error 409 ahí), acá el caller es un form
    // público: se responde éxito con el inscrito ya existente.
    if (email) {
      const existing = await prisma.eventAttendee.findFirst({
        where: { eventId: params.id, email: email.trim().toLowerCase() },
        select: { id: true },
      })
      if (existing) {
        return NextResponse.json({
          success: true,
          attendeeId: existing.id,
          message: 'Este email ya estaba inscripto',
        })
      }
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
