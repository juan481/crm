import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isValidHoraStr } from '@/lib/asistencia-turnos'

interface Params { params: { userId: string } }

// Mismo gate que /api/asistencia/config — es RRHH quien define horarios en
// la práctica, no sólo un Admin comercial.
const canManageAttendance = (role: string) => ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(role)

// Horario laboral INDIVIDUAL de un empleado — hasta 4 tramos (cubre
// mañana+tarde con bache, o un único tramo nocturno). Vacío = el empleado
// usa el horario general de la organización (ver getHorarioEsperado).
const MAX_TRAMOS = 4

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canManageAttendance(payload.role)) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const targetUser = await db.user.findFirst({ where: { id: params.userId, organizationId: payload.orgId }, select: { id: true } })
    if (!targetUser) return NextResponse.json({ error: 'Usuario no encontrado en esta organización' }, { status: 404 })

    const tramos = await db.horarioTramo.findMany({
      where: { userId: params.userId, organizationId: payload.orgId },
      orderBy: { orden: 'asc' },
      select: { id: true, orden: true, horaInicio: true, horaFin: true, toleranciaMinutos: true },
    })

    return NextResponse.json({ data: tramos })
  } catch (error) {
    console.error('[RRHH HORARIO GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Reemplaza TODOS los tramos del empleado por los que vengan en el body
// (mismo patrón que PATCH /api/catalogo/kits/[id] con sus componentes:
// borrar + recrear, más simple que un diff parcial). `tramos: []` borra el
// horario individual — el empleado vuelve a usar el horario general de la
// organización.
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canManageAttendance(payload.role)) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const targetUser = await db.user.findFirst({ where: { id: params.userId, organizationId: payload.orgId }, select: { id: true } })
    if (!targetUser) return NextResponse.json({ error: 'Usuario no encontrado en esta organización' }, { status: 404 })

    const body = await req.json().catch(() => null)
    if (!body || !Array.isArray(body.tramos)) return NextResponse.json({ error: 'Body inválido — falta el array "tramos"' }, { status: 400 })

    if (body.tramos.length > MAX_TRAMOS) {
      return NextResponse.json({ error: `Máximo ${MAX_TRAMOS} tramos por empleado` }, { status: 400 })
    }

    const tramosData: { horaInicio: string; horaFin: string | null; toleranciaMinutos: number }[] = []
    for (let i = 0; i < body.tramos.length; i++) {
      const t = body.tramos[i]
      if (!isValidHoraStr(t?.horaInicio)) {
        return NextResponse.json({ error: `Tramo ${i + 1}: hora de entrada inválida (formato HH:MM)` }, { status: 400 })
      }
      if (t.horaFin !== undefined && t.horaFin !== null && t.horaFin !== '' && !isValidHoraStr(t.horaFin)) {
        return NextResponse.json({ error: `Tramo ${i + 1}: hora de salida inválida (formato HH:MM)` }, { status: 400 })
      }
      const tolerancia = Number(t.toleranciaMinutos)
      if (!Number.isFinite(tolerancia) || tolerancia < 0 || tolerancia > 120) {
        return NextResponse.json({ error: `Tramo ${i + 1}: la tolerancia tiene que ser un número entre 0 y 120 minutos` }, { status: 400 })
      }
      tramosData.push({
        horaInicio: t.horaInicio,
        horaFin: t.horaFin || null,
        toleranciaMinutos: Math.round(tolerancia),
      })
    }

    await db.$transaction([
      db.horarioTramo.deleteMany({ where: { userId: params.userId, organizationId: payload.orgId } }),
      ...tramosData.map((t, i) => db.horarioTramo.create({
        data: {
          userId: params.userId,
          organizationId: payload.orgId,
          orden: i + 1,
          horaInicio: t.horaInicio,
          horaFin: t.horaFin,
          toleranciaMinutos: t.toleranciaMinutos,
        },
      })),
    ])

    const tramos = await db.horarioTramo.findMany({
      where: { userId: params.userId, organizationId: payload.orgId },
      orderBy: { orden: 'asc' },
      select: { id: true, orden: true, horaInicio: true, horaFin: true, toleranciaMinutos: true },
    })

    return NextResponse.json({ data: tramos, message: tramos.length > 0 ? 'Horario actualizado' : 'Horario individual eliminado — vuelve a usar el horario general' })
  } catch (error) {
    console.error('[RRHH HORARIO PUT]', error)
    return NextResponse.json({ error: 'Error al guardar el horario' }, { status: 500 })
  }
}
