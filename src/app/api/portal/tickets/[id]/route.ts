import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPortalUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface Params { params: { id: string } }

// GET: detalle de UN ticket de la Empresa del portal + sus mensajes NO
// internos. Un mensaje isInternal=true (nota entre el staff) nunca se le
// muestra al cliente.
export async function GET(_req: NextRequest, { params }: Params) {
  const portal = await getPortalUser()
  if (!portal) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const ticket = await prisma.ticket.findFirst({
    where: { id: params.id, organizationId: portal.orgId, empresaId: portal.empresaId },
    select: {
      id: true, number: true, title: true, description: true, status: true,
      category: true, priority: true, createdAt: true, resolvedAt: true,
      messages: {
        where: { isInternal: false },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, content: true, createdAt: true,
          user: { select: { name: true, role: true } },
        },
      },
    },
  })
  if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })

  return NextResponse.json({
    data: {
      ...ticket,
      messages: ticket.messages.map((m) => ({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        // No se expone el nombre real del staff — sólo "vos" o "Soporte".
        autor: m.user?.role === 'CLIENTE' ? 'vos' : 'Soporte',
      })),
    },
  })
}

// POST: el cliente agrega un mensaje al hilo. Reabre el ticket si estaba
// resuelto/cerrado.
export async function POST(req: NextRequest, { params }: Params) {
  const portal = await getPortalUser()
  if (!portal) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const content = typeof body?.content === 'string' ? body.content.trim() : ''
  if (!content) return NextResponse.json({ error: 'Escribí un mensaje' }, { status: 400 })

  const ticket = await prisma.ticket.findFirst({
    where: { id: params.id, organizationId: portal.orgId, empresaId: portal.empresaId },
    select: { id: true, status: true },
  })
  if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })

  await prisma.ticketMessage.create({
    data: { ticketId: ticket.id, content, isInternal: false, userId: portal.userId },
  })

  if (ticket.status === 'RESUELTO' || ticket.status === 'CERRADO') {
    await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'ABIERTO', resolvedAt: null } })
  } else {
    await prisma.ticket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } })
  }

  return NextResponse.json({ ok: true })
}
