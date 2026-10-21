import { canAccess } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import type { Role } from '@/types'

// ABBA FISICA (legajos): dato sensible de personal, su propio permiso
// INDEPENDIENTE del piso general SELLER+ (repositorio de Documentos). Un
// documento de legajo se gatea SIEMPRE por el módulo 'legajos', nunca por
// ser SELLER+ a secas — compartido entre todas las rutas que leen/editan/
// borran un Document puntual (antes vivía duplicado sólo en
// src/app/api/documentos/[id]/route.ts, y faltaba en .../versions/route.ts
// — bug real encontrado en code-review: un SELLER sin 'legajos' podía leer
// el historial de versiones de un carnet/DNI/contrato).
export async function canManageDocument(orgId: string, role: Role, doc: { legajoId: string | null }): Promise<boolean> {
  if (doc.legajoId) return roleHasModule(orgId, role, 'legajos')
  return canAccess(role, 'SELLER')
}
