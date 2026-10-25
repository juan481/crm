// Servicios recurrentes / abonos — constantes y helpers compartidos entre la
// UI (/servicios, ficha de empresa) y el backend (API + cron de facturación).

export type Ciclo = 'MENSUAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | 'UNICO'
export type EstadoServicio = 'ACTIVO' | 'PAUSADO' | 'BAJA'
export type ModoLicencia = 'SAAS' | 'PERPETUA' | 'NINGUNA'

export const CICLO_LABEL: Record<Ciclo, string> = {
  MENSUAL: 'Mensual',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
  UNICO: 'Pago único',
}

// Meses que cubre cada ciclo — para normalizar cualquier monto a "por mes"
// (MRR). UNICO no es recurrente: no suma al MRR.
export const CICLO_MESES: Record<Ciclo, number> = {
  MENSUAL: 1, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12, UNICO: 0,
}

export const CICLO_OPTIONS = (Object.keys(CICLO_LABEL) as Ciclo[]).map((value) => ({
  value, label: CICLO_LABEL[value],
}))

export const ESTADO_LABEL: Record<EstadoServicio, string> = {
  ACTIVO: 'Activo', PAUSADO: 'Pausado', BAJA: 'De baja',
}
export const ESTADO_OPTIONS = (Object.keys(ESTADO_LABEL) as EstadoServicio[]).map((value) => ({
  value, label: ESTADO_LABEL[value],
}))

export const MODO_LICENCIA_LABEL: Record<ModoLicencia, string> = {
  SAAS: 'SaaS (suscripción)', PERPETUA: 'Perpetua', NINGUNA: 'No aplica',
}
export const MODO_LICENCIA_OPTIONS = (Object.keys(MODO_LICENCIA_LABEL) as ModoLicencia[]).map((value) => ({
  value, label: MODO_LICENCIA_LABEL[value],
}))

// Canal / origen del ingreso — lista curada (crece sin migración, el campo es
// texto libre). Sirve para separar el MRR por de dónde viene la plata.
export const CANAL_OPTIONS = ['CRM', 'Instalación', 'Otro']

// Monedas soportadas en abonos (mismas que el resto de la facturación).
export const MONEDAS_VALIDAS = ['USD', 'ARS', 'EUR', 'MXN', 'CLP', 'COP', 'UYU', 'BRL']
export function sanitizeMoneda(raw: unknown): string {
  const m = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
  return MONEDAS_VALIDAS.includes(m) ? m : 'USD'
}

export function clampDiaVencimiento(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
  if (!Number.isFinite(n)) return 10
  return Math.min(28, Math.max(1, Math.round(n)))
}

// Forma mínima que necesitan los helpers de facturación (así sirve tanto para
// el registro de Prisma como para objetos parciales de la UI).
export interface AbonoBillingShape {
  monto: number
  ciclo: Ciclo
  estado: EstadoServicio
  contratoInicio?: Date | string | null
  contratoFin?: Date | string | null
  createdAt?: Date | string | null
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return isNaN(d.getTime()) ? null : d
}

// Monto normalizado a "por mes". UNICO devuelve 0 (no es recurrente).
export function montoMensualizado(abono: Pick<AbonoBillingShape, 'monto' | 'ciclo'>): number {
  const meses = CICLO_MESES[abono.ciclo] ?? 1
  if (meses === 0) return 0
  return abono.monto / meses
}

// ¿Este abono genera factura en el mes calendario de `argToday`?
// `argToday` tiene que ser un inicio de día ARGENTINA (ver argentinaDayStart):
// se leen sólo los getters UTC, que sobre ese valor representan el día argentino.
export function abonoFacturaEsteMes(
  abono: AbonoBillingShape,
  argToday: Date,
): boolean {
  if (abono.estado !== 'ACTIVO') return false
  if (abono.ciclo === 'UNICO') return false
  if (!(abono.monto > 0)) return false

  const y = argToday.getUTCFullYear()
  const m = argToday.getUTCMonth() // 0–11
  const ym = y * 12 + m

  const inicio = toDate(abono.contratoInicio)
  if (inicio) {
    const inicioYm = inicio.getUTCFullYear() * 12 + inicio.getUTCMonth()
    if (ym < inicioYm) return false
  }

  const fin = toDate(abono.contratoFin)
  if (fin) {
    const finYm = fin.getUTCFullYear() * 12 + fin.getUTCMonth()
    if (ym > finYm) return false // el mes del fin todavía se factura
  }

  if (abono.ciclo === 'MENSUAL') return true

  // Trimestral / semestral / anual: factura en los meses "aniversario" del
  // ancla (inicio de contrato, o alta del abono si no hay inicio cargado).
  const ancla = inicio ?? toDate(abono.createdAt) ?? argToday
  const anclaMonth = ancla.getUTCMonth()
  const step = abono.ciclo === 'TRIMESTRAL' ? 3 : abono.ciclo === 'SEMESTRAL' ? 6 : 12
  return (((m - anclaMonth) % step) + step) % step === 0
}

// Días hasta el fin de contrato (negativo si ya venció, null si no tiene fin).
export function diasHastaFin(contratoFin: Date | string | null | undefined, from: Date = new Date()): number | null {
  const fin = toDate(contratoFin)
  if (!fin) return null
  const day = 24 * 60 * 60 * 1000
  return Math.ceil((fin.getTime() - from.getTime()) / day)
}

// N° de abonado del Ultra (la licencia de monitoreo de Abba) — formato
// "dealer + número", ej. "ABB3434" (Seba, 25/10: ABB es el dealer, 3434 el
// abonado). Se guarda canónico: mayúsculas, sin espacios ni guiones ("abb
// 3434" y "ABB-3434" quedan "ABB3434"). null = vacío; '' (string vacío) =
// formato inválido (el llamador devuelve el 400).
export const ABONADO_FORMATO = /^[0-9A-Z]{2,20}$/
export function normalizarAbonado(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().toUpperCase().replace(/[\s-]+/g, '')
  if (!s) return null
  return ABONADO_FORMATO.test(s) ? s : ''
}

// Ajuste periódico de abonos (AjusteAbono) — cada cuántos meses.
export const AJUSTE_CADA_MESES_OPTIONS = [
  { value: '3', label: 'Cada 3 meses (trimestral)' },
  { value: '6', label: 'Cada 6 meses' },
  { value: '12', label: 'Cada 12 meses' },
]

// Suma `meses` a una fecha-clave "YYYY-MM-DD" (sin pasar por timezone) y
// devuelve otra fecha-clave. Día 31 + 3 meses → se recorta al último día
// del mes destino (ej. 30/11 → 28/02).
export function sumarMesesDateKey(dateKey: string, meses: number): string {
  const [y, m, d] = dateKey.slice(0, 10).split('-').map(Number)
  const total = (m - 1) + meses
  const ny = y + Math.floor(total / 12)
  const nm = ((total % 12) + 12) % 12
  const ultimoDia = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  const nd = Math.min(d, ultimoDia)
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(nd).padStart(2, '0')}`
}
