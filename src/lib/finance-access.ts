import { canAccess } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import type { Role } from '@/types'

// Mismo patrón que puedeVerStock/puedeVerCompras (src/lib/stock-access.ts):
// ADMIN+ siempre; cualquier otro rol (ej. ADMINISTRATIVO) sólo si un Super
// Admin le habilitó el módulo en Configuración → Permisos.
export async function puedeVerServicios(orgId: string, role: Role): Promise<boolean> {
  return canAccess(role, 'ADMIN') || roleHasModule(orgId, role, 'servicios')
}

export async function puedeVerFacturacion(orgId: string, role: Role): Promise<boolean> {
  return canAccess(role, 'ADMIN') || roleHasModule(orgId, role, 'facturas')
}
