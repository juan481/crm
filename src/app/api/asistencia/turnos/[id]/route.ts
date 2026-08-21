import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { argentinaDateKeyToDayStart, argentinaTimeToInstant } from '@/lib/timezone'
import { mirrorAsistencia, MODALIDADES_FICHAJE, ETIQUETAS_TURNO } from '@/lib/asistencia-turnos'

// PATCH — esto es "reasignar horas regulares a extra" (pedido explícito de
// Sergio): un cambio de `etiqueta` sobre un bloque existente, sin endpoint
// especial. Mismo patrón de permisos/scoping que PATCH /api/asistencia/[id].
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const canManage = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(payload.role)
    if (!canManage) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const existing = await db.turnoAsistencia.findFirst({ where: { id: params.id, organizationId: payload.orgId } })
    if (!existing) return NextResponse.json({ error: 'Bloque no encontrado' }, { status: 404 })

    const body = await req.json()
    const data: Record<string, unknown> = { editadoPorId: payload.userId }

    if (body.modalidad !== undefined && MODALIDADES_FICHAJE.includes(body.modalidad)) data.modalidad = body.modalidad
    // Reasignar Regular → Extra/Adicional (o cualquier otra combinación) —
    // no toca el mirror hacia Asistencia por sí sola: reclasificar la
    // etiqueta no borra el hecho de que la persona estuvo presente ese día
    // (decisión confirmada con Juan/Abba).
    if (body.etiqueta !== undefined && ETIQUETAS_TURNO.includes(body.etiqueta)) data.etiqueta = body.etiqueta
    if (body.observaciones !== undefined) data.observaciones = body.observaciones || null
    if (body.tardanza !== undefined) data.tardanza = !!body.tardanza

    let horaEntrada: Date | undefined
    let horaSalida: Date | undefined
    if (body.entradaHora !== undefined) {
      if (!body.entradaHora) { horaEntrada = null as any }
      else {
        const [h, m] = body.entradaHora.split(':').map(Number)
        horaEntrada = argentinaTimeToInstant(existing.fecha, h, m)
      }
      data.horaEntrada = horaEntrada
    }
    if (body.salidaHora !== undefined) {
      if (!body.salidaHora) { horaSalida = null as any }
      else {
        // Fecha de salida independiente — puede ser el día siguiente al
        // de la entrada (cruce de medianoche), a diferencia de los
        // modales viejos de RRHH que fuerzan el mismo día calendario.
        const fechaSalida = body.salidaFecha ? argentinaDateKeyToDayStart(body.salidaFecha) : existing.fecha
        const [h, m] = body.salidaHora.split(':').map(Number)
        horaSalida = argentinaTimeToInstant(fechaSalida, h, m)
      }
      data.horaSalida = horaSalida
    }

    const turno = await db.turnoAsistencia.update({ where: { id: existing.id }, data })

    if (existing.esPrincipal && (horaEntrada !== undefined || horaSalida !== undefined || body.tardanza !== undefined)) {
      await mirrorAsistencia(db, {
        userId: existing.userId, organizationId: payload.orgId, fecha: existing.fecha,
        ...(horaEntrada !== undefined && { horaEntrada }),
        ...(horaSalida !== undefined && { horaSalida }),
        ...(body.tardanza !== undefined && { tardanza: !!body.tardanza }),
      })
    }

    return NextResponse.json({ data: turno })
  } catch (error) {
    console.error('[TURNOS PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar el bloque' }, { status: 500 })
  }
}

// DELETE — mismo nivel más estricto que ya tiene DELETE /api/asistencia/[id]
// (sin HR). Si el bloque borrado era el principal, blanquea (no borra) la
// fila de Asistencia de ese día en vez de dejarla con datos huérfanos —
// conserva ausente/observaciones si ya estaban cargados a mano.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const canDelete = ['SUPER_ADMIN', 'ADMIN'].includes(payload.role)
    if (!canDelete) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const existing = await db.turnoAsistencia.findFirst({ where: { id: params.id, organizationId: payload.orgId } })
    if (!existing) return NextResponse.json({ error: 'Bloque no encontrado' }, { status: 404 })

    await db.turnoAsistencia.delete({ where: { id: existing.id } })

    if (existing.esPrincipal) {
      await mirrorAsistencia(db, {
        userId: existing.userId, organizationId: payload.orgId, fecha: existing.fecha,
        horaEntrada: null, horaSalida: null, tardanza: false,
      })
    }

    return NextResponse.json({ message: 'Bloque eliminado' })
  } catch (error) {
    console.error('[TURNOS DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar el bloque' }, { status: 500 })
  }
}
