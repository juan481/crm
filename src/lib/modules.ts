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
  { id: 'cotizador',      label: 'Cotizador',       defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'],                          minRole: 'SELLER' },
  { id: 'cotizaciones',   label: 'Cotizaciones',    defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'],                          minRole: 'SELLER' },
  { id: 'tickets',        label: 'Tickets',         defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER', 'TECHNICIAN'],            minRole: 'TECHNICIAN' },
  // Técnico gana Eventos por default a partir de este sistema — requiere el
  // piso ampliado en src/app/api/eventos/route.ts y [id]/route.ts (GET) para
  // que este default sea real y no sólo cosmético (ver comentario ahí).
  { id: 'eventos',        label: 'Eventos',         defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER', 'TECHNICIAN'],            minRole: 'TECHNICIAN' },
  { id: 'comunicaciones', label: 'Comunicaciones',  defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'],                          minRole: 'SELLER' },
  { id: 'facturas',       label: 'Facturación',     defaultRoles: ['SUPER_ADMIN', 'ADMIN'],                                    minRole: 'ADMIN' },
  { id: 'documentos',     label: 'Documentos',      defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'],                          minRole: 'SELLER' },
  { id: 'empresas',       label: 'Empresas',        defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'],                          minRole: 'SELLER' },
  { id: 'contactos',      label: 'Contactos',       defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'],                          minRole: 'SELLER' },
  { id: 'rrhh',           label: 'RRHH',            defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'HR'],                              minRole: 'HR' },
  { id: 'mi-asistencia',  label: 'Mi Asistencia',   defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'SELLER', 'TECHNICIAN', 'HR'],      minRole: 'TECHNICIAN' },
]

export function getModule(id: string): ModuleDefinition | undefined {
  return MODULE_DEFINITIONS.find((m) => m.id === id)
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
}

export function roleAtLeast(role: Role, required: Role): boolean {
  return ROLE_LEVEL[role] >= ROLE_LEVEL[required]
}
