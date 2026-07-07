'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/store/auth-store'
import { useThemeStore } from '@/store/theme-store'
import { Sidebar } from '@/components/layout/sidebar'
import { AppHeader } from '@/components/layout/AppHeader'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import type { User } from '@/types'

// Routes each restricted role may access. Everything else redirects to their default.
const ROLE_ALLOWED_PREFIXES: Partial<Record<User['role'], string[]>> = {
  HR:         ['/rrhh', '/mi-asistencia', '/tareas'],
  TECHNICIAN: ['/mi-dia', '/mi-asistencia', '/tareas'],
}
const ROLE_DEFAULT: Partial<Record<User['role'], string>> = {
  HR:         '/rrhh',
  TECHNICIAN: '/mi-dia',
}

interface Branding {
  crmName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
}

interface AppShellProps {
  user: User
  branding: Branding | null
  children: React.ReactNode
}

const pageVariants = {
  hidden:  { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.14, ease: 'easeOut' } },
}

export function AppShell({ user, branding, children }: AppShellProps) {
  const { setUser } = useAuthStore()
  const { loadBranding } = useThemeStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router   = useRouter()

  useEffect(() => {
    setUser(user)
    if (branding) loadBranding(branding)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Protect restricted roles from accessing routes outside their allowed list
  useEffect(() => {
    const allowed  = ROLE_ALLOWED_PREFIXES[user.role]
    const fallback = ROLE_DEFAULT[user.role]
    if (allowed && fallback) {
      const ok = allowed.some(p => pathname === p || pathname.startsWith(p + '/'))
      if (!ok) router.replace(fallback)
    }
  }, [pathname, user.role]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* Sidebar — fixed left */}
      <Sidebar
        user={user}
        crmName={branding?.crmName ?? 'CRM Pro'}
        logoUrl={branding?.logoUrl ?? null}
        mobile={false}
      />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-40 lg:hidden">
            <Sidebar
              user={user}
              crmName={branding?.crmName ?? 'CRM Pro'}
              logoUrl={branding?.logoUrl ?? null}
              mobile
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppHeader user={user} onMenuToggle={() => setSidebarOpen(v => !v)} />

        {/* Beta environment notice */}
        <div className="px-4 py-2 text-xs text-center font-medium shrink-0"
          style={{ background: 'rgba(245,158,11,0.12)', borderBottom: '1px solid rgba(245,158,11,0.25)', color: 'rgb(180,120,20)' }}>
          Entorno de prueba (Beta) — podés experimentar lentitud o algún bug ocasional.
          Si encontrás algún problema, reportalo al administrador.
        </div>

        <main className="flex-1 overflow-y-auto">
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                variants={pageVariants}
                initial="hidden"
                animate="visible"
                className="p-4 lg:p-6 max-w-7xl mx-auto w-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
