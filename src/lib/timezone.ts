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

/** Fecha "sin hora" (ej. vencimiento de una factura) construida a partir de
 *  año/mes/día explícitos — mediodía UTC de ese día, no medianoche: así, al
 *  formatearse en el navegador del usuario (timezone Argentina) o en
 *  cualquier timezone cercana, siempre muestra el día correcto sin que la
 *  franja de medianoche la corra un día para atrás. Bug real encontrado:
 *  `new Date(y, m, 5)` construido en el server (UTC) se mostraba como "4"
 *  en el navegador (Argentina). `month` es 0-indexado, igual que el
 *  constructor nativo de Date. */
export function dateOnlyArgentina(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 12, 0, 0))
}

/** Días calendario (puede ser negativo) entre HOY (día argentino real,
 *  funciona igual en server o browser) y la fecha-clave de un campo
 *  @db.Date ya serializado a ISO ("YYYY-MM-DDT00:00:00.000Z"). Comparar
 *  ese ISO directo contra `Date.now()` corre el resultado ~3hs por el
 *  huso horario (bug real encontrado en code-review, ver badges de
 *  vencimiento de carnet en /legajos) — acá se comparan sólo los
 *  componentes de fecha, nunca el instante completo. */
export function daysUntilDateOnly(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const target = Date.UTC(y, m - 1, d, 12)
  const [ty, tm, td] = argentinaDayKey().split('-').map(Number)
  const today = Date.UTC(ty, tm - 1, td, 12)
  return Math.round((target - today) / 86_400_000)
}

/** Formatea un campo @db.Date ya serializado a ISO como "DD/MM/YYYY" —
 *  parsea el string directo, nunca construye un Date "timezone-aware" (ver
 *  daysUntilDateOnly arriba: `new Date(iso).toLocaleDateString()` muestra
 *  el día anterior en un navegador Argentina). Antes vivía duplicado en
 *  cada página de /legajos. */
export function fmtDateOnly(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** Medianoche (UTC) del día argentino para una clave "YYYY-MM-DD" ya
 *  conocida (ej. un <input type="date">, o Asistencia.fecha ya serializada
 *  a string) — mismo shape que argentinaDayStart, para no pasar por el
 *  constructor local de Date al armar un instante manual (bug real: los
 *  modales de edición de RRHH armaban `new Date(y, m-1, d, h, m)` con el
 *  constructor LOCAL del navegador, que en el server correría 3hs — acá se
 *  arma explícito para usar junto con argentinaTimeToInstant). */
export function argentinaDateKeyToDayStart(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** Rango [inicio, fin) del mes argentino "YYYY-MM" (ej. de SalesTarget/
 *  CommissionLedger.month) como INSTANTES reales — para filtrar
 *  `closedAt`/`paidAt` (DateTime completo, no una fecha "sin hora") con
 *  `gte`/`lt` sin el corrimiento de 3hs que da armar el rango con el
 *  constructor local de Date en un server que corre en UTC.
 *
 *  OJO, bug real que esto corrigió en code-review: `argentinaDateKeyToDayStart`
 *  da la medianoche UTC de esa fecha-clave (para comparar contra columnas
 *  @db.Date, donde sólo importa que el año/mes/día coincidan) — NO es el
 *  instante real de la medianoche ARGENTINA (que cae a las 03:00 UTC, por
 *  el offset -3). Usar ese resultado directo como límite de un rango contra
 *  un DateTime real arrancaba (y cortaba) el mes 3hs antes de lo real.
 *  argentinaTimeToInstant() es la función que sí hace esa conversión. */
export function argentinaMonthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number)
  const startDayKey = argentinaDateKeyToDayStart(`${y}-${String(m).padStart(2, '0')}-01`)
  const nextY = m === 12 ? y + 1 : y
  const nextM = m === 12 ? 1 : m + 1
  const endDayKey = argentinaDateKeyToDayStart(`${nextY}-${String(nextM).padStart(2, '0')}-01`)
  return {
    start: argentinaTimeToInstant(startDayKey, 0, 0),
    end: argentinaTimeToInstant(endDayKey, 0, 0),
  }
}
