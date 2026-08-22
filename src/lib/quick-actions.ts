import type { Role } from '@/types'

// Sin componentes de ícono acá a propósito — este archivo lo importa tanto
// el cliente (mobile-quick-bar.tsx, para el fallback y el cálculo) como
// las rutas API de /api/quick-actions/* (server). El mapeo actionKey→
// ícono/label/href sólo hace falta del lado del cliente y vive en
// mobile-quick-bar.tsx — mantenerlo separado evita que un ícono de Lucide
// termine importado sin necesidad en el bundle del servidor.

// Pool completo de acciones candidatas por rol, en el mismo orden que ya
// se usaba como set fijo (v1) — ese orden es también el fallback: si
// alguien todavía no tiene (o tiene poco) uso real registrado, ve
// exactamente el set curado de siempre, sin sorpresas el primer día.
export const QUICK_ACTION_POOL: Partial<Record<Role, string[]>> = {
  TECHNICIAN: ['fichar', 'mi-dia', 'tickets', 'mi-asistencia', 'tareas'],
  SELLER: [
    'cotizador', 'clientes', 'pipeline', 'buscar',
    'cotizaciones', 'empresas', 'contactos', 'tareas', 'tickets', 'comunicaciones', 'documentos',
  ],
  HR: ['fichar', 'rrhh', 'rrhh-turnos', 'tareas', 'mi-asistencia'],
  ADMIN: [
    'dashboard', 'clientes', 'facturas', 'comunicaciones',
    'pipeline', 'cotizador', 'tareas', 'tickets', 'empresas', 'contactos', 'documentos', 'rrhh',
  ],
  SUPER_ADMIN: [
    'dashboard', 'clientes', 'facturas', 'comunicaciones',
    'pipeline', 'cotizador', 'tareas', 'tickets', 'empresas', 'contactos', 'documentos', 'rrhh',
  ],
}

// Primeras 4 de cada pool — el set que ya estaba curado a mano y aprobado
// (v1). Además de fallback para usuarios nuevos, rellena los huecos que
// deja un usuario con MENOS de 4 acciones distintas usadas todavía.
export const QUICK_ACTION_DEFAULTS: Partial<Record<Role, string[]>> = Object.fromEntries(
  Object.entries(QUICK_ACTION_POOL).map(([role, pool]) => [role, pool.slice(0, 4)])
) as Partial<Record<Role, string[]>>

// Ruta → actionKey, para trackear uso real de navegación (ver app-shell.tsx)
// sin importar si se llegó ahí por el sidebar, un link interno o escribiendo
// la URL — todo cuenta igual como "esta persona usa esta pantalla". El
// orden importa: '/rrhh/turnos' tiene que evaluarse ANTES que '/rrhh' o
// nunca se distinguiría de la pantalla principal de RRHH.
const ROUTE_ACTION_KEYS: { prefix: string; key: string }[] = [
  { prefix: '/rrhh/turnos',    key: 'rrhh-turnos' },
  { prefix: '/rrhh',           key: 'rrhh' },
  { prefix: '/mi-dia',         key: 'mi-dia' },
  { prefix: '/tickets',        key: 'tickets' },
  { prefix: '/mi-asistencia',  key: 'mi-asistencia' },
  { prefix: '/tareas',         key: 'tareas' },
  { prefix: '/cotizador',      key: 'cotizador' },
  { prefix: '/clientes',       key: 'clientes' },
  { prefix: '/pipeline',       key: 'pipeline' },
  { prefix: '/cotizaciones',   key: 'cotizaciones' },
  { prefix: '/empresas',       key: 'empresas' },
  { prefix: '/contactos',      key: 'contactos' },
  { prefix: '/comunicaciones', key: 'comunicaciones' },
  { prefix: '/documentos',     key: 'documentos' },
  { prefix: '/dashboard',      key: 'dashboard' },
  { prefix: '/facturas',       key: 'facturas' },
]

export function actionKeyForPath(pathname: string): string | null {
  for (const r of ROUTE_ACTION_KEYS) {
    if (pathname === r.prefix || pathname.startsWith(r.prefix + '/')) return r.key
  }
  return null
}

export interface UsageRow { actionKey: string; count: number; lastUsedAt: Date | string }

// Ranking real primero (más usado → menos usado, desempatando por lo usado
// más recientemente — sin este segundo criterio, un empate en count caía
// en el orden que Postgres devolviera de casualidad, no en algo con
// sentido), completando con los defaults curados si hay menos de 4
// acciones con uso registrado — nunca devuelve menos de 4 mientras el pool
// del rol tenga al menos 4 entradas. Filtra cualquier actionKey que ya no
// exista en el pool del rol (ej. si el usuario cambió de rol, o el pool se
// recorta en el futuro) para no arrastrar una acción fantasma que ya no se
// puede renderizar.
export function computeTopActions(role: Role, usage: UsageRow[]): string[] {
  const pool = QUICK_ACTION_POOL[role]
  if (!pool) return []
  const poolSet = new Set(pool)

  const ranked = [...usage]
    .filter((u) => poolSet.has(u.actionKey))
    .sort((a, b) => b.count - a.count || +new Date(b.lastUsedAt) - +new Date(a.lastUsedAt))
    .map((u) => u.actionKey)

  const defaults = QUICK_ACTION_DEFAULTS[role] ?? []
  const result: string[] = []
  for (const key of [...ranked, ...defaults]) {
    if (result.length >= 4) break
    if (!result.includes(key)) result.push(key)
  }
  return result
}
