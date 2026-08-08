export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserFull } from '@/lib/auth'
import { AppShell } from '@/components/layout/app-shell'
import type { User } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // createClient outside try so it's accessible in the catch for signOut
  const supabase = await createClient()

  try {
    // Ya no se llama a supabase.auth.getUser() acá (era una segunda
    // validación de red contra Supabase, redundante): el middleware ya la
    // hizo para este mismo request antes de llegar acá — mismo criterio que
    // ya usaba getCurrentUser() internamente (ver el comentario en
    // src/lib/auth.ts), ahora aplicado también en este punto de entrada.
    //
    // getCurrentUserFull() resuelve sesión + usuario + organización activa
    // (branding incluido) en 2-3 consultas en vez de las 5 que hacía este
    // layout antes de este fix — corre en CADA navegación (force-dynamic
    // arriba), así que esto es lo que más pesaba en la lentitud reportada.
    // Ya incluye el chequeo de organización de origen suspendida (ver
    // resolveSession() en src/lib/auth.ts) — mismo comportamiento de antes,
    // sólo sin repetir las mismas consultas dos veces.
    const session = await getCurrentUserFull()
    if (!session) {
      await supabase.auth.signOut()
      redirect('/login')
    }
    const { payload, user: dbUser, org: activeOrg } = session!

    if (!dbUser.onboardingCompleted) redirect('/onboarding')
    // Selector de rubro: es por-organización, no por-usuario — un usuario
    // multi-org que ya completó onboarding una vez igual tiene que elegirlo
    // la primera vez que entra a una organización nueva sin rubro.
    if (payload.role === 'SUPER_ADMIN' && !activeOrg.vertical) redirect('/onboarding')

    const user: User = {
      ...dbUser,
      role:      payload.role as User['role'],
      status:    dbUser.status as User['status'],
      createdAt: dbUser.createdAt.toISOString(),
      updatedAt: dbUser.updatedAt.toISOString(),
    }

    return (
      <AppShell
        user={user}
        branding={{
          crmName:        activeOrg.crmName,
          logoUrl:        activeOrg.logoUrl,
          primaryColor:   activeOrg.primaryColor,
          secondaryColor: activeOrg.secondaryColor,
          vertical:       activeOrg.vertical ?? null,
        }}
      >
        {children}
      </AppShell>
    )
  } catch (error: unknown) {
    const isRedirect =
      error instanceof Error && error.message === 'NEXT_REDIRECT'
    if (isRedirect) throw error

    console.error('[DashboardLayout] Error:', error)

    // Sign out BEFORE redirecting — without this, the middleware sees a valid
    // Supabase session and immediately redirects back to /dashboard, creating
    // an infinite redirect loop.
    try { await supabase.auth.signOut() } catch { /* ignore */ }

    redirect('/login')
  }
}
