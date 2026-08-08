export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { AppShell } from '@/components/layout/app-shell'
import type { User } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // createClient outside try so it's accessible in the catch for signOut
  const supabase = await createClient()

  try {
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()

    if (!supabaseUser) redirect('/login')

    // dbUser = identidad de origen (para onboardingCompleted/status, que son
    // por-usuario, no por-organización). homeOrg = su organización de origen
    // — si ESA está suspendida, se cierra la sesión entera sin importar a
    // qué más tenga acceso (ver OrganizationMembership).
    const [dbUser, homeOrg] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma.user as any).findUnique({
        where: { supabaseId: supabaseUser.id },
        select: {
          id: true, email: true, name: true, role: true, status: true,
          onboardingCompleted: true, forcePasswordChange: true,
          avatarUrl: true, organizationId: true, createdAt: true, updatedAt: true,
        },
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma.organization as any).findFirst({
        where: { users: { some: { supabaseId: supabaseUser.id } } },
        select: { suspended: true },
      }),
    ])

    if (!dbUser || dbUser.status !== 'ACTIVE') {
      await supabase.auth.signOut()
      redirect('/login')
    }

    if (homeOrg?.suspended) {
      await supabase.auth.signOut()
      redirect('/login?suspended=1')
    }

    // A partir de acá, la organización que se MUESTRA es la activa (cookie +
    // membership revalidada — mismo choke point que usa toda ruta de API).
    // Para el 100% de los usuarios de un solo tenant esto es idéntico a
    // `homeOrg`. Ver Fase 0.6 del plan.
    const payload = await getCurrentUser()
    if (!payload) { await supabase.auth.signOut(); redirect('/login') }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeOrg = await (prisma.organization as any).findUnique({
      where: { id: payload!.orgId },
      select: { crmName: true, logoUrl: true, primaryColor: true, secondaryColor: true, vertical: true },
    })

    if (!dbUser.onboardingCompleted) redirect('/onboarding')
    // Selector de rubro: es por-organización, no por-usuario — un usuario
    // multi-org que ya completó onboarding una vez igual tiene que elegirlo
    // la primera vez que entra a una organización nueva sin rubro.
    if (payload!.role === 'SUPER_ADMIN' && !activeOrg?.vertical) redirect('/onboarding')

    const user: User = {
      ...dbUser,
      role:      payload!.role as User['role'],
      status:    dbUser.status as User['status'],
      createdAt: dbUser.createdAt.toISOString(),
      updatedAt: dbUser.updatedAt.toISOString(),
    }

    return (
      <AppShell
        user={user}
        branding={activeOrg ? {
          crmName:        activeOrg.crmName,
          logoUrl:        activeOrg.logoUrl,
          primaryColor:   activeOrg.primaryColor,
          secondaryColor: activeOrg.secondaryColor,
          vertical:       activeOrg.vertical ?? null,
        } : null}
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
