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

    // Portal B2B (Módulo 3) — GREMIO nunca monta este AppShell interno, ni
    // por un instante. Va antes que cualquier otro chequeo de este layout
    // (onboarding/forcePasswordChange se resuelven del lado de /gremio si
    // hiciera falta) para evitar el flash client-side que hoy sufren
    // HR/TECHNICIAN (ver ROLE_ALLOWED_PREFIXES en app-shell.tsx).
    if (payload.role === 'GREMIO') redirect('/gremio')

    if (!dbUser.onboardingCompleted) redirect('/onboarding')
    // Selector de rubro: es por-organización, no por-usuario — un usuario
    // multi-org que ya completó onboarding una vez igual tiene que elegirlo
    // la primera vez que entra a una organización nueva sin rubro.
    if (payload.role === 'SUPER_ADMIN' && !activeOrg.vertical) redirect('/onboarding')
    // forcePasswordChange se ESCRIBE en 3 lugares (alta de usuario nuevo con
    // contraseña temporal, reset de contraseña por un ADMIN, alta del primer
    // SUPER_ADMIN de una org desde /admin) pero antes no se leía en ningún
    // lado — quedaba en true para siempre sin que nada lo hiciera cumplir.
    // Dos casos reales sin este chequeo: (1) alguien nuevo apretaba "Saltar"
    // en el paso de contraseña del onboarding y seguía con la temporal
    // indefinidamente; (2) un usuario que YA había completado onboarding
    // hace tiempo, al que un ADMIN le resetea la contraseña, nunca vuelve a
    // pasar por /onboarding — entraba directo al dashboard con la
    // contraseña que el ADMIN acaba de definir, sin ninguna oportunidad (ni
    // obligación) de cambiarla ella misma.
    if (dbUser.forcePasswordChange) redirect('/cambiar-contrasena')

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
