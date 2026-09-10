import { prisma } from '@/lib/db'

// Devuelve un User.id para atribuir acciones "del sistema" en una organización
// (notas de timeline, mensajes de ticket automáticos, etc.).
//
// Necesario porque NO toda organización tiene un User propio: la org de la
// agencia (Just Create) se creó con sólo una OrganizationMembership para el
// dueño — su User vive en su org de origen. Sin este fallback, todo lo que
// hace `EmpresaNota.userId` requerido no se creaba para esas orgs (timeline
// vacío pese a que la factura se envió / el pago entró).
//
// Orden: 1) SUPER_ADMIN/ADMIN propio de la org → 2) cualquiera con membership
// a la org → 3) cualquier platform admin.
export async function getOrgActorUserId(orgId: string): Promise<string | null> {
  const own = await prisma.user.findFirst({
    where: { organizationId: orgId, role: { in: ['SUPER_ADMIN', 'ADMIN'] }, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (own) return own.id

  const membership = await prisma.organizationMembership.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'asc' },
    select: { userId: true },
  })
  if (membership) return membership.userId

  const platformAdmin = await prisma.user.findFirst({
    where: { isPlatformAdmin: true, status: 'ACTIVE' },
    select: { id: true },
  })
  return platformAdmin?.id ?? null
}
