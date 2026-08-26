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
    // GREMIO no participa de esta jerarquía (portal B2B lateral, ver
    // comentario en el enum Role del schema) — el -1 es sólo una red de
    // seguridad fail-closed para que TS compile y para que un llamado
    // legacy a canAccess('GREMIO', cualquierCosa) dé false. El control de
    // acceso real del portal es el guard explícito role==='GREMIO' en
    // (gremio)/layout.tsx y en las APIs que consume.
    GREMIO: -1,
  }
  return hierarchy[userRole] >= hierarchy[requiredRole]
}

const ORG_BRANDING_SELECT = {
  suspended: true, crmName: true, logoUrl: true, primaryColor: true, secondaryColor: true, vertical: true,
} as const

type OrgBranding = {
  suspended: boolean; crmName: string; logoUrl: string | null
  primaryColor: string; secondaryColor: string; vertical: string | null
}

interface ResolvedSession {
  user: {
    id: string; email: string; name: string; status: string
    onboardingCompleted: boolean; forcePasswordChange: boolean; avatarUrl: string | null
    organizationId: string; createdAt: Date; updatedAt: Date
  }
  orgId: string
  role: Role
  homeSuspended: boolean
  // Org activa completa (branding + su propio suspended) — null sólo si el
  // id resuelto no corresponde a ninguna organización real (no debería pasar).
  org: OrgBranding | null
}

// Único lugar que resuelve sesión + organización activa — getCurrentUser()
// (usado por toda ruta de API) y el layout del dashboard (que necesita el
// perfil completo del usuario + el branding de la org, no sólo el payload
// chico) comparten esto para no repetir las mismas consultas dos veces.
// Antes de este refactor, el layout llamaba a getCurrentUser() COMPLETO
// además de hacer sus propias consultas de usuario/organización — hasta 5
// round-trips a la DB en cada navegación (el layout corre en cada una,
// force-dynamic). Ahora son 2 en el caso común (sin cambiar de
// organización), 3 en el caso de estar en una organización distinta a la
// de origen.
//
// Mismas reglas de siempre, sin cambios de comportamiento: la cookie nunca
// es la fuente de verdad por sí sola, se revalida la membership contra la
// DB con el userId que ya salió de la sesión autenticada, y CUALQUIER cosa
// que no cierre 100% cae en silencio a la organización de origen. La
// suspensión de la organización de ORIGEN sigue forzando el cierre de
// sesión siempre — incluso mientras se está viendo otra organización vía
// membership — exactamente igual que antes de este refactor (por eso
// homeSuspended se resuelve siempre, no sólo en el camino sin cookie).
async function resolveSession(): Promise<ResolvedSession | null> {
  const supabase = await createClient()
  // getSession() reads the JWT from the cookie locally — fast, no Supabase network call.
  // The middleware already calls getUser() on every request and refreshes the token,
  // so the session in the cookie is always fresh when this runs.
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  // Un solo round-trip para usuario + organización de origen (antes eran 2
  // consultas secuenciales acá, más una TERCERA en el camino de switch de
  // organización — ver abajo). Esto corre en CADA request autenticado de
  // TODA la app (cualquier ruta de API llama a getCurrentUser()), así que
  // el ahorro se multiplica por cada fetch que dispare una pantalla, no
  // sólo por cada navegación. Encontrado midiendo directo contra la base:
  // hasta una consulta trivial por clave única tardaba ~1s por el
  // mismatch de región Vercel↔Supabase ya diagnosticado — la forma real de
  // no pagarlo dos veces es no hacer dos viajes cuando uno alcanza.
  const user = await prisma.user.findUnique({
    where: { supabaseId: session.user.id },
    select: {
      id: true, email: true, name: true, role: true, status: true,
      onboardingCompleted: true, forcePasswordChange: true, avatarUrl: true,
      organizationId: true, createdAt: true, updatedAt: true,
      organization: { select: ORG_BRANDING_SELECT },
    },
  })
  if (!user || user.status !== 'ACTIVE') return null
  const { organization: homeOrg, ...userRest } = user

  let orgId = userRest.organizationId
  let role = userRest.role as Role
  let org: OrgBranding | null = homeOrg
  // Ya lo tenemos del include de arriba — antes era una consulta aparte
  // incluso en el camino de switch de organización.
  const homeSuspended = homeOrg?.suspended ?? true

  const cookieStore = await cookies()
  const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value

  if (activeOrgId && activeOrgId !== userRest.organizationId) {
    const membership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: userRest.id, organizationId: activeOrgId } },
      select: { role: true, organization: { select: ORG_BRANDING_SELECT } },
    })
    if (membership && !membership.organization.suspended) {
      // Membership válida — la org activa es la del switch. homeSuspended
      // ya se resolvió arriba con el include, se sigue respetando la regla
      // de "origen suspendida = fuera" sin una consulta extra para eso.
      orgId = activeOrgId
      role = membership.role as Role
      org = membership.organization
      return { user: userRest, orgId, role, homeSuspended, org }
    }
    // Cookie inválida/manipulada o membership a una org suspendida — cae a
    // home sin excepción, mismo criterio que siempre.
  }

  return { user: userRest, orgId, role, homeSuspended, org }
}

// Returns the same AuthPayload shape as before — no changes needed in API routes
export async function getCurrentUser(): Promise<AuthPayload | null> {
  try {
    const resolved = await resolveSession()
    if (!resolved || resolved.homeSuspended) return null
    return { userId: resolved.user.id, orgId: resolved.orgId, role: resolved.role, email: resolved.user.email }
  } catch {
    return null
  }
}

// Para (dashboard)/layout.tsx — evita que además de esto tenga que volver a
// buscar el usuario y la organización por su cuenta (ver resolveSession()).
export interface FullSession {
  payload: AuthPayload
  user: ResolvedSession['user']
  org: OrgBranding
}

export async function getCurrentUserFull(): Promise<FullSession | null> {
  try {
    const resolved = await resolveSession()
    if (!resolved || resolved.homeSuspended || !resolved.org) return null
    return {
      payload: { userId: resolved.user.id, orgId: resolved.orgId, role: resolved.role, email: resolved.user.email },
      user: resolved.user,
      org: resolved.org,
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
