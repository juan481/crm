import { prisma } from '@/lib/db'
import { getModule, roleAtLeast } from '@/lib/modules'
import type { Role } from '@/types'

// ¿El rol tiene acceso EFECTIVO a este módulo en esta org?
//
//  = cumple el piso de seguridad del módulo (minRole)
//    Y (hay fila ModulePermission que lo habilita  |  no hay fila y el default
//       del módulo incluye a ese rol).
//
// Misma lógica de fallback que el GET de /api/module-permissions. Lo usan las
// APIs de los módulos cuyo piso se bajó a TECHNICIAN (catálogo, cotizador…)
// para que el toggle del panel de Permisos gobierne de verdad y no sólo el
// menú lateral.
export async function roleHasModule(orgId: string, role: Role, moduleId: string): Promise<boolean> {
  const def = getModule(moduleId)
  if (!def) return false
  if (role === 'SUPER_ADMIN') return true
  if (!roleAtLeast(role, def.minRole)) return false

  const row = await (prisma as any).modulePermission.findUnique({
    where: { organizationId_moduleId_role: { organizationId: orgId, moduleId, role } },
    select: { enabled: true },
  })
  return row ? row.enabled : def.defaultRoles.includes(role)
}
