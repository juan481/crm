import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { argentinaDayKey, dateOnlyArgentina } from '@/lib/timezone'
import { diaDeAgenda } from '@/lib/deal-contacto'
import { dealParaAgenda } from '@/lib/deal-agenda'

interface Params { params: { id: string } }

// Agenda de contacto de una oportunidad — pedido de Abba (Seba, 25/10): "se
// pone una agenda para dentro de 3 días y a los tres días le aparece que
// tiene que contactar a Juan". Cada agenda es una Task (ver
// src/lib/deal-contacto.ts) asignada al responsable de la oportunidad.

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const deal = await dealParaAgenda(payload, params.id)
    if (!deal) return NextResponse.json({ error: 'Oportunidad no encontrada' }, { status: 404 })

    const tasks = await (prisma as any).task.findMany({
      where: { dealId: deal.id, status: { in: ['PENDIENTE', 'EN_CURSO'] }, dueDate: { not: null } },
      orderBy: { dueDate: 'asc' },
      select: { id: true, title: true, description: true, dueDate: true, assignedTo: { select: { name: true } } },
    })
    return NextResponse.json({
      data: tasks.map((t: any) => ({ id: t.id, title: t.title, description: t.description, dia: diaDeAgenda(t.dueDate), asignado: t.assignedTo?.name ?? null })),
    })
  } catch (error) {
    console.error('[DEAL AGENDA GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST { fecha: 'YYYY-MM-DD', nota?: string } — agenda un contacto. Queda a
// nombre del responsable de la oportunidad (aunque lo agende un admin).
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const deal = await dealParaAgenda(payload, params.id)
    if (!deal) return NextResponse.json({ error: 'Oportunidad no encontrada' }, { status: 404 })

    const b = await req.json().catch(() => ({}))
    const fecha = typeof b.fecha === 'string' ? b.fecha.trim() : ''
    const nota = typeof b.nota === 'string' ? b.nota.trim().slice(0, 500) : ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return NextResponse.json({ error: 'Elegí el día' }, { status: 400 })
    if (fecha < argentinaDayKey()) return NextResponse.json({ error: 'El día ya pasó — elegí hoy o más adelante' }, { status: 400 })

    const [y, m, d] = fecha.split('-').map(Number)
    const task = await (prisma as any).task.create({
      data: {
        title: `Contactar: ${deal.title}`,
        description: nota || null,
        priority: 'MEDIA',
        dueDate: dateOnlyArgentina(y, m - 1, d),
        assignedToId: deal.ownerId,
        createdById: payload.userId,
        dealId: deal.id,
        empresaId: deal.empresaId,
        organizationId: payload.orgId,
      },
      select: { id: true },
    })
    return NextResponse.json({ data: { id: task.id, dia: fecha } }, { status: 201 })
  } catch (error) {
    console.error('[DEAL AGENDA POST]', error)
    return NextResponse.json({ error: 'Error al agendar' }, { status: 500 })
  }
}
