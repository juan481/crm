import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db  = prisma as any
    const now  = new Date()
    const hoy  = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Check if already checked in today
    const existing = await db.asistencia.findFirst({
      where: { userId: payload.userId, organizationId: payload.orgId, fecha: hoy },
    })
    if (existing?.horaEntrada) {
      return NextResponse.json({ error: 'Ya registraste tu entrada hoy', data: existing }, { status: 409 })
    }

    // Tardanza: entrada después de attendanceStartTime + tolerancia,
    // configurables por organización desde RRHH (antes era fijo 09:15 para
    // todo el mundo). "HH:MM" en texto simple — se parsea a mano acá.
    const org = await prisma.organization.findUnique({
      where: { id: payload.orgId },
      select: { attendanceStartTime: true, attendanceToleranceMinutes: true },
    })
    const [startH, startM] = (org?.attendanceStartTime ?? '09:00').split(':').map(Number)
    const toleranceMin = org?.attendanceToleranceMinutes ?? 15
    const horaCut = new Date(hoy)
    horaCut.setHours(startH || 9, (startM || 0) + toleranceMin, 0, 0)
    const tardanza = now > horaCut

    const record = existing
      ? await db.asistencia.update({ where: { id: existing.id }, data: { horaEntrada: now, tardanza, ausente: false } })
      : await db.asistencia.create({
          data: {
            userId:         payload.userId,
            organizationId: payload.orgId,
            fecha:          hoy,
            horaEntrada:    now,
            tardanza,
            ausente:        false,
          },
        })

    return NextResponse.json({ data: record, tardanza })
  } catch (err) {
    console.error('[ASISTENCIA CHECK-IN]', err)
    return NextResponse.json({ error: 'Error al registrar entrada' }, { status: 500 })
  }
}
