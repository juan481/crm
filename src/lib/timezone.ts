// Fichaje/asistencia es un dato de negocio atado al día calendario y al
// horario de ARGENTINA (dónde están los empleados), no al del proceso que
// corre el código. En Vercel las funciones serverless corren en UTC por
// default (sin TZ configurado en el proyecto) — usar los getters "locales"
// de Date (getHours/getDate/setHours/...) ahí adentro los resuelve como si
// fueran UTC, no Argentina. Esto se detectó auditando el fichaje: tanto el
// día calendario ("hoy") como el propio corte de tardanza terminaban
// desplazados 3 horas — "09:00" configurado en RRHH se aplicaba como 09:00
// UTC = 06:00 Argentina, así que cualquier fichaje normal de la mañana ya
// llegaba "tarde" para el sistema.
//
// Argentina no aplica horario de verano desde 2009 (UTC-3 fijo todo el
// año), así que un offset constante alcanza sin traer una librería de
// timezones completa. Todo acá trabaja en milisegundos desde epoch — es
// determinístico sin importar en qué timezone corra el proceso (server o
// browser). Si este CRM se usa alguna vez fuera de Argentina, esto tiene
// que volverse configurable por organización.
const ARGENTINA_UTC_OFFSET_HOURS = -3
const ARGENTINA_OFFSET_MS = ARGENTINA_UTC_OFFSET_HOURS * 60 * 60 * 1000

/** Medianoche (UTC) del día calendario argentino que contiene `d` (default:
 *  ahora) — usar para comparar/guardar contra Asistencia.fecha. */
export function argentinaDayStart(d: Date = new Date()): Date {
  const shifted = new Date(d.getTime() + ARGENTINA_OFFSET_MS)
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()))
}

/** Mismo día, como string "YYYY-MM-DD" — para comparar contra fechas ISO ya
 *  serializadas sin reconstruir un Date. */
export function argentinaDayKey(d: Date = new Date()): string {
  const shifted = new Date(d.getTime() + ARGENTINA_OFFSET_MS)
  const y = shifted.getUTCFullYear()
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const day = String(shifted.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Instante UTC real que corresponde a las `hours:minutes` hora ARGENTINA
 *  del día representado por `dayStart` (medianoche UTC, ver
 *  argentinaDayStart) — para armar cortes de horario (ej. tardanza) sin
 *  pasar por los getters/setters "locales" de Date. */
export function argentinaTimeToInstant(dayStart: Date, hours: number, minutes: number): Date {
  return new Date(dayStart.getTime() - ARGENTINA_OFFSET_MS + hours * 60 * 60 * 1000 + minutes * 60 * 1000)
}
