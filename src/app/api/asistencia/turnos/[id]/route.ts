import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { argentinaDateKeyToDayStart, argentinaTimeToInstant } from '@/lib/timezone'
import { mirrorAsistencia, MODALIDADES_FICHAJE, ETIQUETAS_TURNO, isValidHoraStr, isValidDateKey } from '@/lib/asistencia-turnos'

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

    // Bug real encontrado en auditoría: sin `.catch()`, un body vacío o
    // JSON malformado tiraba una excepción no controlada → 500 genérico
    // en vez de un error claro.
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

    const data: Record<string, unknown> = { editadoPorId: payload.userId }

    if (body.modalidad !== undefined && MODALIDADES_FICHAJE.includes(body.modalidad)) data.modalidad = body.modalidad
    // Reasignar Regular → Extra/Adicional (o cualquier otra combinación) —
    // no toca el mirror hacia Asistencia por sí sola: reclasificar la
    // etiqueta no borra el hecho de que la persona estuvo presente ese día
    // (decisión confirmada con Juan/Abba).
    if (body.etiqueta !== undefined && ETIQUETAS_TURNO.includes(body.etiqueta)) data.etiqueta = body.etiqueta
    if (body.observaciones !== undefined) data.observaciones = body.observaciones || null
    if (body.tardanza !== undefined) data.tardanza = !!body.tardanza

    // Bug real encontrado en auditoría: no había bounds-checking de
    // hora/minuto ("25:99" pasaba de largo) y `argentinaTimeToInstant`
    // sencillamente corre la fecha resultante a otro día/hora sin avisar —
    // rompe la garantía de que `fecha` siempre representa el día
    // argentino de la entrada. Ahora se rechaza con 400 en vez de guardar
    // un instante corrido.
    if (body.entradaHora !== undefined && body.entradaHora && !isValidHoraStr(body.entradaHora)) {
      return NextResponse.json({ error: 'Hora de entrada inválida (formato HH:MM)' }, { status: 400 })
    }
    if (body.salidaHora !== undefined && body.salidaHora && !isValidHoraStr(body.salidaHora)) {
      return NextResponse.json({ error: 'Hora de salida inválida (formato HH:MM)' }, { status: 400 })
    }
    if (body.salidaFecha !== undefined && body.salidaFecha && !isValidDateKey(body.salidaFecha)) {
      return NextResponse.json({ error: 'Fecha de salida inválida' }, { status: 400 })
    }
    // Mismo bug que en POST: mandar salidaFecha sin salidaHora se
    // descartaba en silencio (el bloque quedaba como si no se hubiera
    // tocado ese campo, sin ningún aviso al que edita).
    if (body.salidaFecha && !body.salidaHora) {
      return NextResponse.json({ error: 'Falta la hora de salida' }, { status: 400 })
    }

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
// (sin HR).
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
      // Bug real encontrado en auditoría: si ese mismo día quedaba OTRO
      // bloque vivo (un Extra/Adicional), antes se blanqueaba Asistencia
      // igual — el día pasaba a verse como "sin fichar" en el % de
      // presentismo aunque la persona sí hubiera trabajado ese día (el
      // bloque extra seguía visible en el panel, pero el reporte lo
      // descontaba). Ahora se promueve el bloque más antiguo que quede
      // ese día a "principal" en su lugar, y recién si no queda ninguno
      // se blanquea la fila mirror (conserva ausente/observaciones si ya
      // estaban cargados a mano).
      const otro = await db.turnoAsistencia.findFirst({
        where: { userId: existing.userId, organizationId: payload.orgId, fecha: existing.fecha },
        orderBy: { horaEntrada: 'asc' },
      })
      if (otro) {
        await db.turnoAsistencia.update({ where: { id: otro.id }, data: { esPrincipal: true } })
        await mirrorAsistencia(db, {
          userId: existing.userId, organizationId: payload.orgId, fecha: existing.fecha,
          horaEntrada: otro.horaEntrada, horaSalida: otro.horaSalida, tardanza: otro.tardanza,
        })
      } else {
        await mirrorAsistencia(db, {
          userId: existing.userId, organizationId: payload.orgId, fecha: existing.fecha,
          horaEntrada: null, horaSalida: null, tardanza: false,
        })
      }
    }

    return NextResponse.json({ message: 'Bloque eliminado' })
  } catch (error) {
    console.error('[TURNOS DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar el bloque' }, { status: 500 })
  }
}
