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

    const existing = await db.asistencia.findFirst({
      where: { userId: payload.userId, organizationId: payload.orgId, fecha: hoy },
    })
    if (!existing) return NextResponse.json({ error: 'Primero debés registrar tu entrada' }, { status: 400 })
    if (!existing.horaEntrada) return NextResponse.json({ error: 'No hay entrada registrada hoy' }, { status: 400 })
    if (existing.horaSalida)  return NextResponse.json({ error: 'Ya registraste tu salida hoy', data: existing }, { status: 409 })

    const record = await db.asistencia.update({
      where: { id: existing.id },
      data:  { horaSalida: now },
    })

    // Calcular horas trabajadas para respuesta
    const ms       = now.getTime() - new Date(existing.horaEntrada).getTime()
    const horasStr = `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`

    return NextResponse.json({ data: record, horasTrabajadas: horasStr })
  } catch (err) {
    console.error('[ASISTENCIA CHECK-OUT]', err)
    return NextResponse.json({ error: 'Error al registrar salida' }, { status: 500 })
  }
}
