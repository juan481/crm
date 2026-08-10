import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isPluginEnabled } from '@/lib/plugins'
import { pushEventToGoogleCalendar } from '@/lib/google-calendar'

interface Params { params: { id: string } }

// Sincronización manual, a pedido — un botón en la ficha de la tarea, no
// un sync automático en cada creación/edición (evitar sorpresas si el
// plugin está activado pero la cuenta conectada no es la que el usuario
// esperaba, y evitar duplicar el evento si se sincroniza más de una vez
// a propósito no se guarda un vínculo persistente en esta primera
// versión).
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!(await isPluginEnabled(payload.orgId, 'google-calendar'))) {
      return NextResponse.json({ error: 'El plugin de Google Calendar no está activado' }, { status: 400 })
    }

    const db = prisma as any
    const tarea = await db.task.findFirst({
      where: {
        id: params.id, organizationId: payload.orgId,
        ...(['SELLER', 'TECHNICIAN', 'HR'].includes(payload.role) && { assignedToId: payload.userId }),
      },
      select: { id: true, title: true, description: true, dueDate: true },
    })
    if (!tarea) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })
    if (!tarea.dueDate) return NextResponse.json({ error: 'La tarea no tiene fecha de vencimiento' }, { status: 400 })

    // Las tareas del CRM no tienen hora de fin — se arma un evento de 30
    // min arrancando en dueDate, más útil en el calendario que un evento
    // "todo el día".
    const start = new Date(tarea.dueDate)
    const end = new Date(start.getTime() + 30 * 60 * 1000)

    const result = await pushEventToGoogleCalendar(payload.orgId, {
      title: tarea.title,
      description: tarea.description,
      start,
      end,
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })

    return NextResponse.json({ message: 'Agregada a Google Calendar', eventUrl: result.eventUrl })
  } catch (error) {
    console.error('[TAREA GOOGLE CALENDAR]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
