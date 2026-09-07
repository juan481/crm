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

// Canal de ingreso — lista curada (crece sin migración, el campo es texto libre).
export const CANAL_OPTIONS = ['CRM', 'Trisquelia', 'Instalación', 'Otro']

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
