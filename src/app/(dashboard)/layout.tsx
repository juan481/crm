export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { AppShell } from '@/components/layout/app-shell'
import type { User } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // createClient outside try so it's accessible in the catch for signOut
  const supabase = await createClient()

  try {
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()

    if (!supabaseUser) redirect('/login')

    const [dbUser, org] = await Promise.all([
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
        select: { crmName: true, logoUrl: true, primaryColor: true, secondaryColor: true },
      }),
    ])

    if (!dbUser || dbUser.status !== 'ACTIVE') {
      await supabase.auth.signOut()
      redirect('/login')
    }

    if (!dbUser.onboardingCompleted) redirect('/onboarding')

    const user: User = {
      ...dbUser,
      role:      dbUser.role   as User['role'],
      status:    dbUser.status as User['status'],
      createdAt: dbUser.createdAt.toISOString(),
      updatedAt: dbUser.updatedAt.toISOString(),
    }

    return (
      <AppShell
        user={user}
        branding={org ? {
          crmName:        org.crmName,
          logoUrl:        org.logoUrl,
          primaryColor:   org.primaryColor,
          secondaryColor: org.secondaryColor,
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
