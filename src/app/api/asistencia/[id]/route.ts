import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const canManage = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(payload.role)
    if (!canManage) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any

    const existing = await db.asistencia.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
    })
    if (!existing) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })

    const { ausente, tardanza, observaciones, horaEntrada, horaSalida } = await req.json()

    const data: Record<string, unknown> = { creadoPorId: payload.userId }
    if (ausente        !== undefined) data.ausente        = ausente
    if (tardanza       !== undefined) data.tardanza       = tardanza
    if (observaciones  !== undefined) data.observaciones  = observaciones || null
    if (horaEntrada    !== undefined) data.horaEntrada    = horaEntrada ? new Date(horaEntrada) : null
    if (horaSalida     !== undefined) data.horaSalida     = horaSalida  ? new Date(horaSalida)  : null

    const record = await db.asistencia.update({ where: { id: params.id }, data })
    return NextResponse.json({ data: record })
  } catch (err) {
    console.error('[ASISTENCIA PATCH]', err)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const canManage = ['SUPER_ADMIN', 'ADMIN'].includes(payload.role)
    if (!canManage) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    await db.asistencia.deleteMany({ where: { id: params.id, organizationId: payload.orgId } })
    return NextResponse.json({ message: 'Eliminado' })
  } catch (err) {
    console.error('[ASISTENCIA DELETE]', err)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
