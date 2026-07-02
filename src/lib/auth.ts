import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import type { AuthPayload, Role } from '@/types'

// canAccess remains unchanged — used by all API routes
export function canAccess(userRole: Role, requiredRole: Role): boolean {
  const hierarchy: Record<Role, number> = {
    SUPER_ADMIN: 3,
    ADMIN: 2,
    SELLER: 1,
    HR: 1,
    TECHNICIAN: 0,
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await (prisma.user as any).findUnique({
      where: { supabaseId: session.user.id },
      select: { id: true, organizationId: true, role: true, email: true, status: true },
    })

    if (!user || user.status !== 'ACTIVE') return null

    return {
      userId: user.id,
      orgId:  user.organizationId,
      role:   user.role as Role,
      email:  user.email,
    }
  } catch {
    return null
  }
}
