import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { argentinaDayStart, argentinaTimeToInstant } from '@/lib/timezone'
import { findOpenBlock, etiquetaDefault, mirrorAsistencia, MODALIDADES_FICHAJE } from '@/lib/asistencia-turnos'

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db  = prisma as any
    const now = new Date()
    // argentinaDayStart, no getFullYear/getMonth/getDate directo — esos
    // getters son "locales" al proceso, que en Vercel corre en UTC. Ver
    // src/lib/timezone.ts.
    const hoy = argentinaDayStart(now)

    const body = await req.json().catch(() => ({}))
    const modalidad = MODALIDADES_FICHAJE.includes(body?.modalidad) ? body.modalidad : MODALIDADES_FICHAJE[0]
    // GPS opcional del navegador — nunca obligatorio ni bloqueante (ver
    // attendance-widget.tsx: si el usuario no dio permiso o el navegador no
    // soporta Geolocation, se ficha igual sin lat/lng).
    const lat = Number.isFinite(body?.lat) && Math.abs(body.lat) <= 90 ? body.lat : null
    const lng = Number.isFinite(body?.lng) && Math.abs(body.lng) <= 180 ? body.lng : null

    // Bug real reportado (Gabriel Guias, 2026-08-21): antes se buscaba "la
    // fila de HOY" — si alguien no cerraba la salida de ayer, cruzar la
    // medianoche lo dejaba fichando una entrada nueva sin ningún control,
    // y si en cambio SÍ había una entrada de hoy sin salida, un segundo
    // fichaje quedaba bloqueado sin importar si era un turno nuevo
    // legítimo (extra/adicional). Ahora se busca el bloque ABIERTO más
    // reciente, sin importar de qué día calendario es — eso es lo único
    // que realmente determina si hay una entrada pendiente de cerrar.
    const openBlock = await findOpenBlock(db, payload.userId, payload.orgId)
    if (openBlock) {
      return NextResponse.json(
        { error: 'Ya tenés una entrada sin cerrar — registrá la salida antes de abrir un nuevo bloque.', data: openBlock },
        { status: 409 },
      )
    }

    // ¿Ya existe el bloque "principal" de hoy? Si no, este es — si sí, este
    // es un extra/adicional (o el propio empleado reabre después de un
    // corte). Se decide UNA vez al crear el bloque, nunca se recalcula.
    const yaHayPrincipalHoy = await db.turnoAsistencia.findFirst({
      where: { userId: payload.userId, organizationId: payload.orgId, fecha: hoy, esPrincipal: true },
      select: { id: true },
    })
    const esPrincipal = !yaHayPrincipalHoy
    const etiqueta = etiquetaDefault(hoy, esPrincipal)

    // Tardanza: sólo tiene sentido para el turno Regular — un extra o un
    // fin de semana/feriado no se evalúa contra el horario de entrada de
    // la org. Mismo cálculo de siempre, configurable por HR desde RRHH
    // (attendanceStartTime/attendanceToleranceMinutes), armado con
    // argentinaTimeToInstant — nunca con setHours "local" (ese bug ya se
    // encontró y arregló una vez, ver comentario original de este archivo
    // en el historial de git).
    let tardanza = false
    if (etiqueta === 'Regular') {
      const org = await prisma.organization.findUnique({
        where: { id: payload.orgId },
        select: { attendanceStartTime: true, attendanceToleranceMinutes: true },
      })
      const [rawH, rawM] = (org?.attendanceStartTime ?? '09:00').split(':').map(Number)
      // Bug real encontrado en auditoría: `startH || 9` reemplazaba
      // silenciosamente un horario configurado como "00:xx" (turno que
      // arranca a medianoche — plausible para guardias) por las 9am,
      // porque 0 es falsy en JS. Con `Number.isFinite`, 0 es un horario
      // válido y sólo se usa el default si el valor es NaN de verdad.
      const startH = Number.isFinite(rawH) ? rawH : 9
      const startM = Number.isFinite(rawM) ? rawM : 0
      const toleranceMin = org?.attendanceToleranceMinutes ?? 15
      const horaCut = argentinaTimeToInstant(hoy, startH, startM + toleranceMin)
      tardanza = now > horaCut
    }

    const turno = await db.turnoAsistencia.create({
      data: {
        userId: payload.userId,
        organizationId: payload.orgId,
        fecha: hoy,
        horaEntrada: now,
        modalidad,
        etiqueta,
        esPrincipal,
        tardanza,
        latEntrada: lat,
        lngEntrada: lng,
      },
    })

    if (esPrincipal) {
      await mirrorAsistencia(db, {
        userId: payload.userId, organizationId: payload.orgId, fecha: hoy,
        horaEntrada: now, tardanza,
      })
    }

    return NextResponse.json({ data: turno, tardanza, esPrincipal })
  } catch (err: any) {
    // Doble-click / reintento de red casi simultáneo: dos requests pueden
    // ver `findOpenBlock` en null y ambos intentar crear un bloque — no hay
    // constraint de DB que lo impida (índice único parcial queda como
    // hardening opcional, ver plan), así que en el peor caso quedan dos
    // bloques abiertos y el próximo check-out cierra el más reciente. No
    // es un P2002 esperable acá (no hay @@unique en TurnoAsistencia), pero
    // se deja el catch por las dudas de una excepción de conexión.
    console.error('[ASISTENCIA CHECK-IN]', err)
    return NextResponse.json({ error: 'Error al registrar entrada' }, { status: 500 })
  }
}
