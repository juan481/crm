import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount)
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
}

export const NOTE_TYPE_ICONS: Record<string, string> = {
  NOTE: 'StickyNote',
  CALL: 'Phone',
  EMAIL: 'Mail',
  MEETING: 'Users',
  TASK: 'CheckSquare',
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrador',
  SELLER: 'Vendedor',
}

// Country list
export const COUNTRIES = [
  'Argentina', 'México', 'Colombia', 'Chile', 'Uruguay', 'Paraguay',
  'Bolivia', 'Perú', 'Ecuador', 'Venezuela', 'Brasil', 'España',
  'Estados Unidos', 'Otro',
]

// MRR growth calculation
export function calcGrowthPercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}
