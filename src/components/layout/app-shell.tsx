'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/store/auth-store'
import { useThemeStore } from '@/store/theme-store'
import { Sidebar } from '@/components/layout/sidebar'
import { AppHeader } from '@/components/layout/AppHeader'
import { MobileQuickBar } from '@/components/layout/mobile-quick-bar'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { actionKeyForPath } from '@/lib/quick-actions'
import type { User } from '@/types'

// Routes each restricted role may access. Everything else redirects to their default.
const ROLE_ALLOWED_PREFIXES: Partial<Record<User['role'], string[]>> = {
  HR:         ['/rrhh', '/mi-asistencia', '/tareas', '/ayuda', '/mi-perfil'],
  TECHNICIAN: ['/mi-dia', '/mi-asistencia', '/tareas', '/tickets', '/eventos', '/ayuda', '/mi-perfil'],
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
  // Rubro de la organización (src/lib/verticals.ts) — filtra qué ítems del
  // nav ve cada tenant. Null = todavía no eligió (no oculta nada).
  vertical: string | null
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
    // Este mount sólo pasa una vez por carga COMPLETA de página (no en cada
    // navegación interna del dashboard) — es el momento correcto para
    // "resetear" el guard de auto-reload por ChunkLoadError (ver
    // error-boundary.tsx): esta carga ya trajo el bundle actual, así que si
    // más adelante otro deploy rompe un chunk, se puede volver a
    // auto-recuperar en vez de quedar bloqueado desde una vieja recarga.
    sessionStorage.removeItem('crm-chunk-reload-attempted')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Presencia real — una vez por sesión de navegador (se resetea al cerrar
  // la pestaña/navegador, no en cada click interno). Existe para capturar a
  // todo el equipo que YA estaba logueado de antes de que este feature
  // existiera: sin esto, esas cuentas nunca iban a mostrar "última vez"
  // hasta un logout/login manual — no tiene sentido pedirle eso a todo un
  // equipo. type:'SEEN' (no es un login real) para no mezclarlo con
  // ingresos/salidas explícitos en el historial detallado.
  useEffect(() => {
    if (sessionStorage.getItem('crm-presence-logged')) return
    sessionStorage.setItem('crm-presence-logged', '1')
    fetch('/api/auth/log-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'SEEN' }),
    }).catch(() => {})
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

  // Uso real para la Barra Rápida (v2, ver src/lib/quick-actions.ts) — cada
  // navegación a una pantalla candidata cuenta como "uso", sin importar si
  // se llegó por el sidebar, un link interno o la URL a mano. Fire-and-
  // forget a propósito: nunca debe demorar ni romper la navegación en sí.
  useEffect(() => {
    const key = actionKeyForPath(pathname)
    if (!key) return
    fetch('/api/quick-actions/track', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionKey: key }),
    }).catch(() => {})
  }, [pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* Sidebar — fixed left */}
      <Sidebar
        user={user}
        crmName={branding?.crmName ?? 'CRM Pro'}
        logoUrl={branding?.logoUrl ?? null}
        vertical={branding?.vertical ?? null}
        mobile={false}
      />

      {/* Mobile sidebar overlay — antes esto era un simple `{sidebarOpen &&
          (...)}`, así que el drawer aparecía/desaparecía de golpe sin
          ninguna transición (al desmontar no hay tiempo para animar una
          transición CSS común). AnimatePresence sí anima la salida antes de
          sacarlo del DOM — mismo mecanismo que ya usa este archivo para la
          transición entre páginas más abajo. */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="sidebar-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-30 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              key="sidebar-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="fixed inset-y-0 left-0 z-40 lg:hidden"
            >
              <Sidebar
                user={user}
                crmName={branding?.crmName ?? 'CRM Pro'}
                logoUrl={branding?.logoUrl ?? null}
                vertical={branding?.vertical ?? null}
                mobile
                onClose={() => setSidebarOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppHeader user={user} onMenuToggle={() => setSidebarOpen(v => !v)} />

        <main className="flex-1 overflow-y-auto">
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                variants={pageVariants}
                initial="hidden"
                animate="visible"
                // pb-20 (no sólo lg:p-6) — deja lugar para la Barra Rápida
                // fija de abajo en mobile; en desktop (lg:hidden en la
                // barra) no hace falta, así que se anula con lg:pb-6.
                className="p-4 pb-20 lg:p-6 lg:pb-6 max-w-7xl mx-auto w-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
        </main>

        <MobileQuickBar userId={user.id} role={user.role} onMore={() => setSidebarOpen(true)} />
      </div>
    </div>
  )
}
