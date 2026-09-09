import { canAccess } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import type { Role } from '@/types'

// Acceso al Depósito (módulo `stock`): ADMIN+ siempre; cualquier otro rol
// sólo si un Super Admin le habilitó el módulo en Configuración → Permisos.
// El piso viejo (ADMIN) cortocircuita → sin query extra para ADMIN/SUPER_ADMIN.
// Mismo patrón que `catalogo-gestion` en products/[id]/stock/route.ts.
export async function puedeVerStock(orgId: string, role: Role): Promise<boolean> {
  return canAccess(role, 'ADMIN') || roleHasModule(orgId, role, 'stock')
}

// Acceso a Compras — mismo criterio, módulo `compras` (piso ADMIN).
export async function puedeVerCompras(orgId: string, role: Role): Promise<boolean> {
  return canAccess(role, 'ADMIN') || roleHasModule(orgId, role, 'compras')
}

// Acceso a Entregas — módulo `entregas` (piso TECHNICIAN, como Stock).
export async function puedeVerEntregas(orgId: string, role: Role): Promise<boolean> {
  return canAccess(role, 'ADMIN') || roleHasModule(orgId, role, 'entregas')
}
