import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { findOpenBlock, mirrorAsistencia } from '@/lib/asistencia-turnos'

export async function POST() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db  = prisma as any
    const now = new Date()

    // Mismo fix que check-in: se busca el bloque ABIERTO más reciente, no
    // "la fila de hoy" — así un bloque abierto ayer a las 16:00 se sigue
    // encontrando y cerrando bien después de cruzar la medianoche, con su
    // `fecha` ORIGINAL (la jornada a la que pertenece), no la de "hoy" al
    // momento del check-out.
    const openBlock = await findOpenBlock(db, payload.userId, payload.orgId)
    if (!openBlock) {
      return NextResponse.json({ error: 'No hay ninguna entrada abierta para registrar salida.' }, { status: 400 })
    }

    const turno = await db.turnoAsistencia.update({
      where: { id: openBlock.id },
      data: { horaSalida: now },
    })

    if (openBlock.esPrincipal) {
      await mirrorAsistencia(db, {
        userId: payload.userId, organizationId: payload.orgId, fecha: openBlock.fecha,
        horaSalida: now,
      })
    }

    // Calcular horas trabajadas para la respuesta — resta de epoch ms, ya
    // correcta cruzando medianoche (no depende de getters de calendario).
    const ms       = now.getTime() - new Date(openBlock.horaEntrada).getTime()
    const horasStr = `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`

    return NextResponse.json({ data: turno, horasTrabajadas: horasStr })
  } catch (err) {
    console.error('[ASISTENCIA CHECK-OUT]', err)
    return NextResponse.json({ error: 'Error al registrar salida' }, { status: 500 })
  }
}
