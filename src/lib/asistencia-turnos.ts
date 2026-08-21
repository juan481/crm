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
    await db.asistencia.create({
      data: {
        userId, organizationId, fecha,
        horaEntrada: horaEntrada ?? null,
        horaSalida: horaSalida ?? null,
        tardanza: tardanza ?? false,
        ausente: false,
      },
    })
  }
}

/** Jornada de un bloque — SIEMPRE el día argentino de la entrada, nunca de
 *  la salida (así "entrada martes 16:00, salida miércoles 00:00" queda
 *  del lado del martes, sin cortarse a medianoche). */
export function jornadaDelBloque(horaEntrada: Date): Date {
  return argentinaDayStart(horaEntrada)
}
