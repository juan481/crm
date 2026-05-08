'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/store/auth-store'
import { useThemeStore } from '@/store/theme-store'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore()
  const { loadBranding } = useThemeStore()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [ready, setReady] = useState(false)

  // Load user session + branding on mount
  useEffect(() => {
    const init = async () => {
      try {
        const [meRes, brandingRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/settings/branding'),
        ])

        if (!meRes.ok) {
          router.replace('/login')
          return
        }

        const { data: user } = await meRes.json()
        setUser(user)

        if (!user.onboardingCompleted) {
          router.replace('/onboarding')
          return
        }

        if (brandingRes.ok) {
          const { data: branding } = await brandingRes.json()
          if (branding) loadBranding(branding)
        }
      } catch {
        router.replace('/login')
      } finally {
        setReady(true)
        setLoading(false)
      }
    }

    init()
  }, [])

  // Close mobile menu on resize
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 1024) setMobileMenuOpen(false) }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl gradient-bg animate-pulse" />
          <p className="text-sm text-[var(--color-text-muted)]">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="fixed left-0 top-0 h-full z-50 lg:hidden"
            >
              <Sidebar mobile onClose={() => setMobileMenuOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <ErrorBoundary>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="p-4 lg:p-6 max-w-7xl mx-auto w-full"
            >
              {children}
            </motion.div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
