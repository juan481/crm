import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import type { AuthPayload, Role } from '@/types'

// Nombre de la cookie que guarda "en qué organización quiero operar" para un
// usuario con acceso a más de una (ver OrganizationMembership en el schema).
// Nunca es la fuente de verdad por sí sola — getCurrentUser() siempre la
// revalida contra la DB antes de confiar en ella. Ver ADR en ese mismo lugar.
export const ACTIVE_ORG_COOKIE = 'active_org_id'

// canAccess remains unchanged — used by all API routes
export function canAccess(userRole: Role, requiredRole: Role): boolean {
  const hierarchy: Record<Role, number> = {
    SUPER_ADMIN: 4,
    ADMIN: 3,
    SELLER: 2,
    HR: 1,         // canAccess(role, 'HR')  → blocks only TECHNICIAN
    TECHNICIAN: 0, // canAccess(role, 'SELLER') → blocks HR and TECHNICIAN
  }
  return hierarchy[userRole] >= hierarchy[requiredRole]
}

// Returns the same AuthPayload shape as before — no changes needed in API routes
export async function getCurrentUser(): Promise<AuthPayload | null> {
  try {
    const supabase = await createClient()
    // getSession() reads the JWT from the cookie locally — fast, no Supabase network call.
    // The middleware already calls getUser() on every request and refreshes the token,
    // so the session in the cookie is always fresh when this runs.
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return null

    const user = await prisma.user.findUnique({
      where: { supabaseId: session.user.id },
      select: {
        id: true, organizationId: true, role: true, email: true, status: true,
        organization: { select: { suspended: true } },
      },
    })

    if (!user || user.status !== 'ACTIVE' || user.organization.suspended) return null

    // Organización "de origen" — comportamiento exacto de siempre, para el
    // 100% de los usuarios que sólo pertenecen a una organización.
    const home: AuthPayload = {
      userId: user.id,
      orgId:  user.organizationId,
      role:   user.role as Role,
      email:  user.email,
    }

    // Multi-organización (ver OrganizationMembership): sólo entra acá si hay
    // una cookie pidiendo operar en otra org. Nunca se confía en el valor de
    // la cookie por sí solo — se revalida la membership contra la DB en cada
    // request, con el userId que ya salió de la sesión autenticada (nunca de
    // algo que mande el cliente). Cualquier cosa que no cierre 100% (sin
    // membership, org suspendida, cookie manipulada a mano) cae en silencio
    // a `home` — jamás un error, jamás una organización ajena.
    const cookieStore = await cookies()
    const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value
    if (!activeOrgId || activeOrgId === user.organizationId) return home

    const membership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: activeOrgId } },
      select: { role: true, organization: { select: { suspended: true } } },
    })
    if (!membership || membership.organization.suspended) return home

    return {
      userId: user.id,
      orgId:  activeOrgId,
      role:   membership.role as Role,
      email:  user.email,
    }
  } catch {
    return null
  }
}

export interface PlatformAdminPayload {
  userId: string
  email:  string
}

// Orthogonal to getCurrentUser()/canAccess() on purpose: this never checks
// organization.suspended, so the agency can always reach /admin even if its
// own org were ever suspended by mistake — no lockout with no way out.
export async function getPlatformAdmin(): Promise<PlatformAdminPayload | null> {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return null

    const user = await prisma.user.findUnique({
      where: { supabaseId: session.user.id },
      select: { id: true, email: true, status: true, isPlatformAdmin: true },
    })

    if (!user || user.status !== 'ACTIVE' || !user.isPlatformAdmin) return null

    return { userId: user.id, email: user.email }
  } catch {
    return null
  }
}
