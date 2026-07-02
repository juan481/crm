import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// HR/ADMIN: crear registro directo (ej: marcar ausencia para un empleado)
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const canManage = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(payload.role)
    if (!canManage) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { userId, fecha, ausente = true, observaciones, horaEntrada, horaSalida, tardanza = false } = await req.json()
    if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
    if (!fecha)  return NextResponse.json({ error: 'fecha requerida' }, { status: 400 })

    const db   = prisma as any
    const fechaDt = new Date(fecha)

    // Upsert: create or update the record for that day
    const existing = await db.asistencia.findFirst({
      where: { userId, organizationId: payload.orgId, fecha: fechaDt },
    })

    const data: Record<string, unknown> = {
      ausente, tardanza, creadoPorId: payload.userId,
      ...(observaciones !== undefined && { observaciones: observaciones || null }),
      ...(horaEntrada   !== undefined && { horaEntrada: horaEntrada ? new Date(horaEntrada) : null }),
      ...(horaSalida    !== undefined && { horaSalida:  horaSalida  ? new Date(horaSalida)  : null }),
    }

    const record = existing
      ? await db.asistencia.update({ where: { id: existing.id }, data })
      : await db.asistencia.create({ data: { userId, organizationId: payload.orgId, fecha: fechaDt, ...data } })

    return NextResponse.json({ data: record })
  } catch (err) {
    console.error('[ASISTENCIA POST]', err)
    return NextResponse.json({ error: 'Error al crear registro' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const mes    = searchParams.get('mes')     // YYYY-MM
    const userId = searchParams.get('userId')  // filtrar por usuario específico

    const db = prisma as any

    let dateFrom: Date | undefined
    let dateTo:   Date | undefined
    if (mes) {
      const [y, m] = mes.split('-').map(Number)
      dateFrom = new Date(y, m - 1, 1)
      dateTo   = new Date(y, m, 0, 23, 59, 59, 999)
    }

    const where: Record<string, unknown> = { organizationId: payload.orgId }
    if (userId)   where.userId = userId
    if (dateFrom) where.fecha  = { gte: dateFrom, lte: dateTo }

    // HR and ADMIN can see all; others only see their own
    const canSeeAll = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(payload.role)
    if (!canSeeAll) where.userId = payload.userId

    const records = await db.asistencia.findMany({
      where,
      include: { user: { select: { id: true, name: true, role: true, avatarUrl: true } } },
      orderBy: [{ fecha: 'desc' }, { horaEntrada: 'asc' }],
    })

    return NextResponse.json({ data: records })
  } catch (err) {
    console.error('[ASISTENCIA GET]', err)
    return NextResponse.json({ error: 'Error al obtener asistencia' }, { status: 500 })
  }
}
