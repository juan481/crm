import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { argentinaDayStart, argentinaTimeToInstant } from '@/lib/timezone'

export async function POST() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db  = prisma as any
    const now  = new Date()
    // argentinaDayStart, no getFullYear/getMonth/getDate directo — esos
    // getters son "locales" al proceso, que en Vercel corre en UTC. Ver
    // src/lib/timezone.ts.
    const hoy  = argentinaDayStart(now)

    // Check if already checked in today
    const existing = await db.asistencia.findFirst({
      where: { userId: payload.userId, organizationId: payload.orgId, fecha: hoy },
    })
    if (existing?.horaEntrada) {
      return NextResponse.json({ error: 'Ya registraste tu entrada hoy', data: existing }, { status: 409 })
    }

    // Tardanza: entrada después de attendanceStartTime + tolerancia,
    // configurables por organización desde RRHH (antes era fijo 09:15 para
    // todo el mundo). "HH:MM" en texto simple, SIEMPRE hora Argentina —
    // armado vía argentinaTimeToInstant (no horaCut.setHours: ese setter es
    // "local" al proceso = UTC en Vercel, interpretaba "09:00" como 09:00
    // UTC = 06:00 Argentina y marcaba tarde a cualquier fichaje normal de
    // la mañana. Bug real encontrado en auditoría, presente desde que se
    // lanzó el fichaje).
    const org = await prisma.organization.findUnique({
      where: { id: payload.orgId },
      select: { attendanceStartTime: true, attendanceToleranceMinutes: true },
    })
    const [startH, startM] = (org?.attendanceStartTime ?? '09:00').split(':').map(Number)
    const toleranceMin = org?.attendanceToleranceMinutes ?? 15
    const horaCut = argentinaTimeToInstant(hoy, startH || 9, (startM || 0) + toleranceMin)
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
  } catch (err: any) {
    // Doble-click / reintento de red casi simultáneo: dos requests pueden
    // ver `existing` en null y ambos intentar crear — el segundo choca con
    // el @@unique([userId, fecha, organizationId]) del schema (correcto,
    // evita el duplicado), pero sin este catch el usuario veía un 500
    // genérico en vez de "ya fichaste".
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Ya registraste tu entrada hoy' }, { status: 409 })
    }
    console.error('[ASISTENCIA CHECK-IN]', err)
    return NextResponse.json({ error: 'Error al registrar entrada' }, { status: 500 })
  }
}
