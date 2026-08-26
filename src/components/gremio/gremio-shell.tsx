'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { LogOut } from 'lucide-react'
import { useThemeStore } from '@/store/theme-store'
import { useAuthStore } from '@/store/auth-store'
import { GremioBottomNav } from './gremio-bottom-nav'

interface GremioBranding {
  crmName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
}

// Shell mobile-first del portal Gremio (Módulo 3) — deliberadamente mucho
// más simple que AppShell (sin Sidebar de escritorio, sin MobileQuickBar
// pensado para 16 pantallas de staff): sólo un header chico + esta bottom
// nav de 3 ítems fijos. Mismos tokens var(--color-*) que el resto del CRM
// (aplicados acá vía loadBranding, igual mecanismo que ya usa AppShell) para
// que se sienta parte del mismo producto, no un sitio aparte.
export function GremioShell({
  userName,
  branding,
  children,
}: {
  userName: string
  branding: GremioBranding
  children: React.ReactNode
}) {
  const loadBranding = useThemeStore((s) => s.loadBranding)
  const logout = useAuthStore((s) => s.logout)

  useEffect(() => {
    loadBranding(branding)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branding.primaryColor, branding.secondaryColor, branding.crmName, branding.logoUrl])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-surface-overlay)' }}>
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-4 h-14 shrink-0"
        style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {branding.logoUrl ? (
            <Image src={branding.logoUrl} alt={branding.crmName} width={28} height={28} className="rounded-lg object-contain shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-lg gradient-bg shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>{branding.crmName}</p>
            <p className="text-[11px] -mt-0.5" style={{ color: 'var(--color-text-subtle)' }}>Portal Gremio</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-medium truncate max-w-[100px]" style={{ color: 'var(--color-text-muted)' }}>{userName}</span>
          <button
            onClick={() => logout()}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-surface-raised)]"
            style={{ color: 'var(--color-text-subtle)' }}
            title="Cerrar sesión"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-24 max-w-2xl w-full mx-auto">
        {children}
      </main>

      <GremioBottomNav />
    </div>
  )
}
