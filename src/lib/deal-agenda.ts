import { canAccess } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import { prisma } from '@/lib/db'
import { sellerOwnerScope, isScopedPipelineRole } from '@/lib/deal-access'
import type { Role } from '@/types'

// La oportunidad sobre la que se agenda (o se marca hecho) un contacto —
// mismo criterio de acceso que GET /api/deals/[id]: SELLER+ o Pipeline
// habilitado, y un vendedor sólo sobre las suyas. null = no existe o no la
// puede ver.
export async function dealParaAgenda(payload: { orgId: string; userId: string; role: Role }, dealId: string) {
  if (!canAccess(payload.role, 'SELLER') && !(await roleHasModule(payload.orgId, payload.role, 'pipeline'))) return null
  const ownerScope = isScopedPipelineRole(payload.role) ? await sellerOwnerScope(payload.userId) : {}
  return (prisma as any).deal.findFirst({
    where: { id: dealId, organizationId: payload.orgId, ...ownerScope },
    select: { id: true, title: true, ownerId: true, empresaId: true },
  }) as Promise<{ id: string; title: string; ownerId: string; empresaId: string | null } | null>
}
