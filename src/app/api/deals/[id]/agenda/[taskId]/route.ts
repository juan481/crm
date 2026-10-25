import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { dealParaAgenda } from '@/lib/deal-agenda'

interface Params { params: { id: string; taskId: string } }

// POST { accion: 'hecho' | 'cancelar', resultado?: string }
//  hecho    → la tarea queda HECHA y se carga una nota en la Actividad de la
//             oportunidad (cuenta como contacto para la alerta de días sin
//             contacto, ver src/lib/deal-contacto.ts).
//  cancelar → se borra la agenda (se agendó mal o ya no hace falta).
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const deal = await dealParaAgenda(payload, params.id)
    if (!deal) return NextResponse.json({ error: 'Oportunidad no encontrada' }, { status: 404 })

    const b = await req.json().catch(() => ({}))
    const accion = b.accion
    if (accion !== 'hecho' && accion !== 'cancelar') return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })

    const db = prisma as any
    const task = await db.task.findFirst({
      where: { id: params.taskId, dealId: deal.id, organizationId: payload.orgId, status: { in: ['PENDIENTE', 'EN_CURSO'] } },
      select: { id: true, description: true },
    })
    if (!task) return NextResponse.json({ error: 'Esa agenda ya no está pendiente' }, { status: 404 })

    if (accion === 'cancelar') {
      await db.task.delete({ where: { id: task.id } })
      return NextResponse.json({ ok: true })
    }

    const resultado = typeof b.resultado === 'string' ? b.resultado.trim().slice(0, 1000) : ''
    const content = [
      '✅ Contacto agendado: hecho',
      task.description ? `Qué había que hacer: ${task.description}` : null,
      resultado ? `Resultado: ${resultado}` : null,
    ].filter(Boolean).join('\n')

    await db.$transaction([
      db.task.update({ where: { id: task.id }, data: { status: 'HECHA', completedAt: new Date() } }),
      db.dealNota.create({ data: { dealId: deal.id, organizationId: payload.orgId, userId: payload.userId, tipo: 'LLAMADA', content } }),
    ])
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DEAL AGENDA ACCION]', error)
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }
}
