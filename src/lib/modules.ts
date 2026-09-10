import type { Role } from '@/types'

export const ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'SELLER', 'HR', 'TECHNICIAN']

export interface ModuleDefinition {
  id: string
  label: string
  // Roles que ven el módulo si NO hay fila en ModulePermission para esa
  // organización — calcado 1:1 de los arrays `roles` que ya estaban
  // hardcodeados en sidebar.tsx, para que ninguna organización existente
  // (Abba, Just Create) pierda ni gane nada el día que se activó este
  // sistema (tabla vacía = comportamiento idéntico a antes).
  defaultRoles: Role[]
  // Piso real de canAccess() en la(s) API(s) de este módulo. El panel de
  // permisos nunca puede habilitar un rol por debajo de esto — lo hace
  // cumplir POST /api/module-permissions, no sólo la UI.
  minRole: Role
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  { id: 'dashboard',      label: 'Dashboard',       defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'],                          minRole: 'SELLER' },
  { id: 'mi-dia',         label: 'Mi Día',          defaultRoles: ['TECHNICIAN'],                                              minRole: 'TECHNICIAN' },
  { id: 'clientes',       label: 'Clientes',        defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'],                          minRole: 'SELLER' },
  { id: 'pipeline',       label: 'Pipeline',        defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'],                          minRole: 'SELLER' },
  { id: 'tareas',         label: 'Tareas',          defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER', 'TECHNICIAN', 'HR'],      minRole: 'TECHNICIAN' },
  // Técnico puede ganar Cotizador / Cotizaciones / Catálogo desde el panel de
  // permisos (piso bajado a TECHNICIAN). El default sigue siendo SELLER+, así
  // que ninguna org existente cambia hasta que un Super Admin prenda el toggle.
  // Las APIs de estos módulos chequean roleHasModule() (ver src/lib/module-access.ts).
  { id: 'cotizador',      label: 'Cotizador',       defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'],                          minRole: 'TECHNICIAN' },
  { id: 'cotizaciones',   label: 'Cotizaciones',    defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'],                          minRole: 'TECHNICIAN' },
  { id: 'catalogo',       label: 'Catálogo',        defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'],                          minRole: 'TECHNICIAN' },
  // "Catálogo · cargar productos y stock" — permiso separado de sólo ver el
  // catálogo. Habilita /catalogo/gestion + las APIs de alta/edición de
  // productos y ajuste de stock. Default ADMIN+.
  { id: 'catalogo-gestion', label: 'Catálogo · cargar productos y stock', defaultRoles: ['SUPER_ADMIN', 'ADMIN'],              minRole: 'TECHNICIAN' },
  { id: 'tickets',        label: 'Tickets',         defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER', 'TECHNICIAN'],            minRole: 'TECHNICIAN' },
  // Técnico gana Eventos por default a partir de este sistema — requiere el
  // piso ampliado en src/app/api/eventos/route.ts y [id]/route.ts (GET) para
  // que este default sea real y no sólo cosmético (ver comentario ahí).
  { id: 'eventos',        label: 'Eventos',         defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER', 'TECHNICIAN'],            minRole: 'TECHNICIAN' },
  { id: 'comunicaciones', label: 'Comunicaciones',  defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'],                          minRole: 'SELLER' },
  { id: 'conversaciones', label: 'WhatsApp',        defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'],                          minRole: 'SELLER' },
  { id: 'servicios',      label: 'Servicios',       defaultRoles: ['SUPER_ADMIN', 'ADMIN'],                                    minRole: 'ADMIN' },
  { id: 'facturas',       label: 'Facturación',     defaultRoles: ['SUPER_ADMIN', 'ADMIN'],                                    minRole: 'ADMIN' },
  // Depósito — stock físico propio, movimientos y alertas de costo. El piso
  // baja a TECHNICIAN para que un encargado de depósito (rol Técnico en Abba)
  // pueda tenerlo desde el panel de Permisos; el default sigue siendo ADMIN+.
  // Las APIs de /api/stock/* chequean canAccess('ADMIN') || roleHasModule(...).
  { id: 'stock',          label: 'Depósito · Stock', defaultRoles: ['SUPER_ADMIN', 'ADMIN'],                                   minRole: 'TECHNICIAN' },
  // Compras a proveedores + OCR de facturas + cuentas por pagar. Toca datos
  // de costo y pago → default y piso más altos que Stock.
  { id: 'compras',        label: 'Depósito · Compras', defaultRoles: ['SUPER_ADMIN', 'ADMIN'],                                 minRole: 'ADMIN' },
  // Entregas / remitos internos — egresos de material a obra o mostrador.
  // Piso TECHNICIAN (el depósito prepara y entrega); default ADMIN+.
  { id: 'entregas',       label: 'Depósito · Entregas', defaultRoles: ['SUPER_ADMIN', 'ADMIN'],                                minRole: 'TECHNICIAN' },
  { id: 'documentos',     label: 'Documentos',      defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'],                          minRole: 'SELLER' },
  { id: 'empresas',       label: 'Empresas',        defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'],                          minRole: 'SELLER' },
  { id: 'contactos',      label: 'Contactos',       defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'],                          minRole: 'SELLER' },
  { id: 'rrhh',           label: 'RRHH',            defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'HR'],                              minRole: 'HR' },
  { id: 'mi-asistencia',  label: 'Mi Asistencia',   defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER', 'TECHNICIAN', 'HR'],      minRole: 'TECHNICIAN' },
]

export function getModule(id: string): ModuleDefinition | undefined {
  return MODULE_DEFINITIONS.find((m) => m.id === id)
}

// Prefijo de ruta de cada módulo — para que app-shell.tsx pueda dejar entrar
// a un TECHNICIAN a las rutas de los módulos que un Super Admin le habilitó
// (por default TECHNICIAN sólo puede /mi-dia, /tareas, /tickets, /eventos…).
// Sólo se listan los módulos que un rol restringido puede llegar a ganar.
export const MODULE_ROUTES: Record<string, string> = {
  catalogo: '/catalogo',
  'catalogo-gestion': '/catalogo/gestion',
  cotizador: '/cotizador',
  cotizaciones: '/cotizaciones',
  stock: '/stock',
  compras: '/compras',
  entregas: '/entregas',
}

// Jerarquía idéntica a canAccess() en src/lib/auth.ts — duplicada acá a
// propósito para no crear una dependencia circular entre src/lib/auth.ts
// (server-only, usa next/headers) y este archivo (importado también por el
// sidebar, client component). Si canAccess() cambia de jerarquía, este mapa
// tiene que cambiar junto — ambos están cerca y comentados.
const ROLE_LEVEL: Record<Role, number> = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
  SELLER: 2,
  HR: 1,
  TECHNICIAN: 0,
  // GREMIO y CLIENTE no entran a ROLES (no deben aparecer como columna en la
  // matriz de /configuracion/permisos, que gobierna el sidebar del AppShell
  // interno que esos portales nunca ven) — sólo están acá para que TS no
  // rompa. Mismo criterio que auth.ts.
  GREMIO: -1,
  CLIENTE: -1,
}

export function roleAtLeast(role: Role, required: Role): boolean {
  return ROLE_LEVEL[role] >= ROLE_LEVEL[required]
}
