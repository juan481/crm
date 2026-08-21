import { argentinaDayStart } from '@/lib/timezone'

// Listas curadas en TS (no enum de Prisma) — mismo criterio ya usado en
// src/lib/fiscal.ts para condicionIva/formaPagoHabitual: Sergio (RRHH)
// filtra sobre un set chico y puede necesitar ajustarlo sin pedir una
// migración de base. A propósito SIN opción "Otra" — Sergio pidió un set
// cerrado justamente para poder filtrar por etiqueta, un catch-all lo
// rompería.
export const MODALIDADES_FICHAJE = ['Presencial', 'Pasivo (Remoto)']
export const ETIQUETAS_TURNO = ['Regular', 'Extra/Adicional', 'Fin de Semana/Feriado']

export function esFinDeSemana(fecha: Date): boolean {
  // `fecha` ya es un argentinaDayStart (medianoche UTC que representa el
  // día argentino) — getUTCDay() sobre esa fecha ya refleja el día de la
  // semana correcto en Argentina, sin pasar por getters "locales".
  const d = fecha.getUTCDay()
  return d === 0 || d === 6
}

// Etiqueta por defecto al abrir un bloque — Sergio puede reasignarla
// después vía PATCH (ver /api/asistencia/turnos/[id]), esto es sólo el
// punto de partida razonable. Limitación conocida y aceptada: sólo
// detecta sábado/domingo, no feriados entre semana (no existe calendario
// de feriados en el sistema) — esos casos se reasignan a mano.
export function etiquetaDefault(fecha: Date, esPrincipal: boolean): string {
  if (esFinDeSemana(fecha)) return 'Fin de Semana/Feriado'
  return esPrincipal ? 'Regular' : 'Extra/Adicional'
}

// Bloque abierto (sin salida) más reciente de un usuario — reemplaza el
// viejo "buscar la fila de HOY" que rompía el cruce de medianoche (una
// entrada de ayer a las 16:00 dejaba de encontrarse al hacer checkout
// después de las 00:00, porque "hoy" ya era otro día calendario).
export async function findOpenBlock(db: any, userId: string, organizationId: string) {
  return db.turnoAsistencia.findFirst({
    where: { userId, organizationId, horaSalida: null },
    orderBy: { horaEntrada: 'desc' },
  })
}

// Espeja el bloque "principal" del día hacia Asistencia — la tabla vieja
// NO se toca de otra forma, sigue siendo la fuente real de
// ausente/tardanza/% de presentismo/cron de avisos. Se llama sólo cuando
// el TurnoAsistencia tocado tiene esPrincipal=true (el primero del día).
// Al setear una entrada real, fuerza ausente:false — evita que un día
// marcado ausente a mano por RRHH quede inconsistente si después aparece
// un bloque real (ej. se cargó una ausencia por error, o la persona
// terminó yendo más tarde).
export async function mirrorAsistencia(db: any, params: {
  userId: string
  organizationId: string
  fecha: Date
  horaEntrada?: Date | null
  horaSalida?: Date | null
  tardanza?: boolean
}): Promise<void> {
  const { userId, organizationId, fecha, horaEntrada, horaSalida, tardanza } = params
  const existing = await db.asistencia.findFirst({ where: { userId, organizationId, fecha } })

  const data: Record<string, unknown> = {}
  if (horaEntrada !== undefined) {
    data.horaEntrada = horaEntrada
    if (horaEntrada) data.ausente = false
  }
  if (horaSalida !== undefined) data.horaSalida = horaSalida
  if (tardanza !== undefined) data.tardanza = tardanza

  if (existing) {
    await db.asistencia.update({ where: { id: existing.id }, data })
  } else {
    try {
      await db.asistencia.create({
        data: {
          userId, organizationId, fecha,
          horaEntrada: horaEntrada ?? null,
          horaSalida: horaSalida ?? null,
          tardanza: tardanza ?? false,
          ausente: false,
        },
      })
    } catch (err: any) {
      // Bug real encontrado en auditoría: dos check-ins casi simultáneos
      // del mismo usuario (mismo día, sin bloque previo) pueden ambos ver
      // `existing` en null acá arriba antes de que el otro termine su
      // create — el segundo choca con @@unique([userId, fecha,
      // organizationId]) de Asistencia (P2002). Antes esto subía sin
      // atajar hasta el catch del endpoint y devolvía 500 DESPUÉS de que
      // el TurnoAsistencia ya se había guardado con éxito — el usuario
      // veía un error pero su fichaje había quedado registrado igual.
      // Se resuelve releyendo la fila que la otra ejecución ya creó y
      // aplicándole el mismo update, en vez de perder el resultado.
      if (err.code !== 'P2002') throw err
      const race = await db.asistencia.findFirst({ where: { userId, organizationId, fecha } })
      if (!race) throw err
      await db.asistencia.update({ where: { id: race.id }, data })
    }
  }
}

// "HH:MM", 00-23 / 00-59 — mismo regex que ya usa /api/asistencia/config
// para validar attendanceStartTime. Bug real encontrado en auditoría: los
// endpoints de turnos no validaban esto, así que un horario tipo "25:99"
// pasaba de largo y corría la fecha del bloque a otro día sin avisar.
export function isValidHoraStr(s: unknown): s is string {
  return typeof s === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(s)
}

// "YYYY-MM-DD" con mes 01-12 y día 01-31 — rechaza en vez de dejar que
// Date.UTC normalice en silencio un valor fuera de rango (ej. "2026-13-45"
// se convertía en otra fecha real sin ningún error).
export function isValidDateKey(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s)
}

/** Jornada de un bloque — SIEMPRE el día argentino de la entrada, nunca de
 *  la salida (así "entrada martes 16:00, salida miércoles 00:00" queda
 *  del lado del martes, sin cortarse a medianoche). */
export function jornadaDelBloque(horaEntrada: Date): Date {
  return argentinaDayStart(horaEntrada)
}
