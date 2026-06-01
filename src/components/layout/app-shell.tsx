'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { useThemeStore } from '@/store/theme-store'
import { Sidebar } from './Sidebar'
import { AppHeader } from './AppHeader'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import type { User } from '@/types'

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

export function AppShell({ user, branding, children }: AppShellProps) {
  const { setUser } = useAuthStore()
  const { loadBranding } = useThemeStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setUser(user)
    if (branding) loadBranding(branding)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

        <main className="flex-1 overflow-y-auto">
          <ErrorBoundary>
            <div className="p-4 lg:p-6 max-w-7xl mx-auto w-full page-enter">
              {children}
            </div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
