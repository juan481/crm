import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Params { params: { token: string } }

// Público — sin sesión. El token en sí es la autenticación (mismo patrón
// que Evento.webhookSecret / el link de /unsubscribe). Alcanza registrado
// en /valorar-ticket/[token] y en PUBLIC_PATHS de src/middleware.ts.

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const db = prisma as any
    const ticket = await db.ticket.findFirst({
      where: { satisfactionToken: params.token },
      select: {
        number: true, title: true, status: true,
        satisfactionRating: true, satisfactionRatedAt: true,
        organization: { select: { name: true, crmName: true, primaryColor: true, secondaryColor: true } },
      },
    })
    if (!ticket) return NextResponse.json({ error: 'Enlace inválido' }, { status: 404 })
    return NextResponse.json({ data: ticket })
  } catch (error) {
    console.error('[TICKET RATING GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { rating, comment } = await req.json()
    const ratingNum = Number(rating)
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json({ error: 'La calificación debe ser de 1 a 5' }, { status: 400 })
    }

    const db = prisma as any
    const existing = await db.ticket.findFirst({ where: { satisfactionToken: params.token } })
    if (!existing) return NextResponse.json({ error: 'Enlace inválido' }, { status: 404 })
    if (existing.satisfactionRatedAt) {
      return NextResponse.json({ error: 'Este ticket ya fue calificado' }, { status: 409 })
    }
    // El link se emailó para UNA resolución puntual — si el ticket se
    // reabrió después (antes de que el cliente califique), ese ciclo ya no
    // está esperando una calificación todavía.
    if (existing.status !== 'RESUELTO' && existing.status !== 'CERRADO') {
      return NextResponse.json({ error: 'Este ticket fue reabierto y todavía no fue resuelto de nuevo' }, { status: 409 })
    }

    await db.ticket.update({
      where: { id: existing.id },
      data: {
        satisfactionRating: ratingNum,
        satisfactionComment: comment?.trim() || null,
        satisfactionRatedAt: new Date(),
      },
    })

    return NextResponse.json({ message: 'Calificación registrada' })
  } catch (error) {
    console.error('[TICKET RATING POST]', error)
    return NextResponse.json({ error: 'Error al registrar la calificación' }, { status: 500 })
  }
}
