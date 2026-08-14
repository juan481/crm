import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// `Intl.NumberFormat` tira un RangeError SÍNCRONO en el constructor si
// `currency` no es un código ISO-4217 válido (ej. vacío, en minúsculas mal
// formado, texto libre) — no devuelve un valor raro, directamente explota.
// `Product.currency`/`Service.currency` son `String` libre en el schema
// (sin enum/check en la DB), y el import CSV de Productos históricamente no
// validaba esa columna antes de postearla — un solo producto con una
// moneda corrupta podía tirar abajo con un error genérico ("Algo salió
// mal") cualquier pantalla que liste precios (Cotizador, catálogo de
// Productos, cotizaciones guardadas). Fallback: formatear sólo el número y
// anteponer el código tal cual vino, nunca crashear por esto.
export function formatCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency || '?'} ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0 }).format(amount)}`
  }
}

// Un monto en USD y otro en ARS no son la misma unidad — nunca se suman
// entre sí. Estos helpers formatean/escalan un total agrupado por moneda
// (ej. { USD: 1200, ARS: 50000 }) para mostrarlo en el dashboard.
export function formatMultiCurrency(byCurrency: Record<string, number> | undefined | null): string {
  const entries = Object.entries(byCurrency ?? {})
  if (entries.length === 0) return formatCurrency(0)
  return entries.map(([cur, v]) => formatCurrency(v, cur)).join(' · ')
}

export function scaleByCurrency(byCurrency: Record<string, number> | undefined | null, factor: number): Record<string, number> {
  return Object.fromEntries(Object.entries(byCurrency ?? {}).map(([cur, v]) => [cur, v * factor]))
}

// Moneda con mayor monto — usada para elegir a cuál de todas corresponde
// mostrar un único indicador de tendencia (ej. % de crecimiento).
export function primaryCurrencyKey(byCurrency: Record<string, number> | undefined | null): string | undefined {
  const entries = Object.entries(byCurrency ?? {})
  if (entries.length === 0) return undefined
  return entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0]
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy', { locale: es })
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "dd MMM yyyy 'a las' HH:mm", { locale: es })
}

export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es })
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim()
}

// Status display helpers
export const CLIENT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  PENDING_PAYMENT: 'Pago Pendiente',
  EXPIRED: 'Vencido',
  PROSPECT: 'Prospecto',
}

export const CLIENT_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  PENDING_PAYMENT: 'warning',
  EXPIRED: 'danger',
  PROSPECT: 'info',
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  PAID: 'Pagado',
  OVERDUE: 'Vencido',
  CANCELLED: 'Cancelado',
}

export const NOTE_TYPE_LABELS: Record<string, string> = {
  NOTE: 'Nota',
  CALL: 'Llamada',
  EMAIL: 'Email',
  MEETING: 'Reunión',
  TASK: 'Tarea',
  CHAT: 'Chat',
}

export const NOTE_TYPE_ICONS: Record<string, string> = {
  NOTE: 'StickyNote',
  CALL: 'Phone',
  EMAIL: 'Mail',
  MEETING: 'Users',
  TASK: 'CheckSquare',
  CHAT: 'MessageCircle',
}

export function toWhatsappUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}`
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN:       'Administrador',
  SELLER:      'Vendedor',
  TECHNICIAN:  'Técnico',
  HR:          'RRHH',
}

// Country list — cubre LatAm (base histórica de Abba) + los países más
// comunes para una agencia con clientes internacionales (Just Create tiene
// clientes en España e Inglaterra). 'Otro' siempre al final, como escape
// hatch para cualquier país no listado (ver EmpresaForm).
export const COUNTRIES = [
  'Argentina', 'México', 'Colombia', 'Chile', 'Uruguay', 'Paraguay',
  'Bolivia', 'Perú', 'Ecuador', 'Venezuela', 'Brasil',
  'España', 'Reino Unido', 'Estados Unidos', 'Canadá',
  'Alemania', 'Francia', 'Italia', 'Portugal',
  'Otro',
]

// MRR growth calculation
export function calcGrowthPercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}
