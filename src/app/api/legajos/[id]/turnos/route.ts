import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import { prisma } from '@/lib/db'
import { argentinaDateKeyToDayStart, argentinaTimeToInstant } from '@/lib/timezone'
import { isValidHoraStr, isValidDateKey } from '@/lib/asistencia-turnos'

export const dynamic = 'force-dynamic'

interface Params { params: { id: string } }

// Turno/asistencia cargado a mano por RRHH — no hay integración con
// VigiControl en esta primera versión (ver comentario en VigiladorTurno,
// schema.prisma). El listado completo ya viaja en GET /api/legajos/[id]
// (últimos 30); este POST es sólo para agregar uno nuevo.
//
// `fecha` es una clave "YYYY-MM-DD" y `horaEntrada`/`horaSalida` son "HH:MM"
// SUELTOS (no un datetime ya combinado) — se combinan server-side con
// argentinaTimeToInstant(), igual criterio que /api/asistencia/turnos.
// Combinarlos en el cliente con `new Date(`${fecha}T${hora}:00`)` (lo que
// hacía la primera versión de este endpoint) se parsea como UTC en el
// server (Vercel corre en UTC) — guardaba cualquier hora 3hs corrida
// respecto de lo que RRHH tipeó (bug real, encontrado en code-review).
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await roleHasModule(payload.orgId, payload.role, 'legajos')))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const vigilador = await db.vigilador.findFirst({ where: { id: params.id, organizationId: payload.orgId }, select: { id: true } })
    if (!vigilador) return NextResponse.json({ error: 'Legajo no encontrado' }, { status: 404 })

    const { fecha, horaEntrada, horaSalida, lugarTrabajo, observaciones } = await req.json()
    if (!fecha || !isValidDateKey(fecha)) return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
    if (horaEntrada && !isValidHoraStr(horaEntrada)) return NextResponse.json({ error: 'Hora de entrada inválida (formato HH:MM)' }, { status: 400 })
    if (horaSalida && !isValidHoraStr(horaSalida)) return NextResponse.json({ error: 'Hora de salida inválida (formato HH:MM)' }, { status: 400 })

    const fechaDayStart = argentinaDateKeyToDayStart(fecha)
    const toInstant = (horaStr: string) => {
      const [h, m] = horaStr.split(':').map(Number)
      return argentinaTimeToInstant(fechaDayStart, h, m)
    }

    const turno = await db.vigiladorTurno.create({
      data: {
        vigiladorId: params.id,
        organizationId: payload.orgId,
        fecha: fechaDayStart,
        horaEntrada: horaEntrada ? toInstant(horaEntrada) : null,
        horaSalida: horaSalida ? toInstant(horaSalida) : null,
        lugarTrabajo: lugarTrabajo?.trim() || null,
        observaciones: observaciones?.trim() || null,
        creadoPorId: payload.userId,
      },
    })

    return NextResponse.json({ data: turno }, { status: 201 })
  } catch (error) {
    console.error('[LEGAJO TURNOS POST]', error)
    return NextResponse.json({ error: 'Error al guardar el turno' }, { status: 500 })
  }
}
