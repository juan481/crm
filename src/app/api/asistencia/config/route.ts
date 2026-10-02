import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canManageAttendance } from '@/lib/asistencia-turnos'
import { roleHasModule } from '@/lib/module-access'

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canManageAttendance(payload.role) && !(await roleHasModule(payload.orgId, payload.role, 'rrhh'))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const org = await prisma.organization.findUnique({
      where: { id: payload.orgId },
      select: { attendanceStartTime: true, attendanceToleranceMinutes: true },
    })
    if (!org) return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })

    return NextResponse.json({ data: org })
  } catch (error) {
    console.error('[ASISTENCIA CONFIG GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canManageAttendance(payload.role) && !(await roleHasModule(payload.orgId, payload.role, 'rrhh'))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { attendanceStartTime, attendanceToleranceMinutes } = await req.json()

    if (typeof attendanceStartTime !== 'string' || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(attendanceStartTime)) {
      return NextResponse.json({ error: 'Hora inválida — usá el formato HH:MM' }, { status: 400 })
    }
    const tolerance = Number(attendanceToleranceMinutes)
    if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 120) {
      return NextResponse.json({ error: 'La tolerancia tiene que ser un número entre 0 y 120 minutos' }, { status: 400 })
    }

    const org = await prisma.organization.update({
      where: { id: payload.orgId },
      data: { attendanceStartTime, attendanceToleranceMinutes: Math.round(tolerance) },
      select: { attendanceStartTime: true, attendanceToleranceMinutes: true },
    })

    return NextResponse.json({ data: org, message: 'Horario actualizado' })
  } catch (error) {
    console.error('[ASISTENCIA CONFIG PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar el horario' }, { status: 500 })
  }
}
