'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, LayoutDashboard, Receipt, LifeBuoy } from 'lucide-react'
import { useThemeStore } from '@/store/theme-store'
import { cn } from '@/lib/utils'

interface PortalBranding {
  crmName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
}

// Shell mobile-first del Portal de Clientes (Pagos & Portal) — mismo criterio
// que GremioShell: header chico + bottom nav, tokens var(--color-*) para que
// se sienta parte del mismo producto. Carril totalmente separado del AppShell
// interno.
const NAV = [
  { href: '/portal', label: 'Inicio', icon: LayoutDashboard },
  { href: '/portal/facturas', label: 'Facturas', icon: Receipt },
  { href: '/portal/soporte', label: 'Soporte', icon: LifeBuoy },
] as const

export function PortalShell({
  userName,
  empresaName,
  branding,
  children,
}: {
  userName: string
  empresaName: string
  branding: PortalBranding
  children: React.ReactNode
}) {
  const loadBranding = useThemeStore((s) => s.loadBranding)
  const pathname = usePathname()

  useEffect(() => {
    loadBranding(branding)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branding.primaryColor, branding.secondaryColor, branding.crmName, branding.logoUrl])

  const logout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch { /* ignore */ }
    window.location.href = '/portal/login'
  }

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
            <p className="text-[11px] -mt-0.5 truncate" style={{ color: 'var(--color-text-subtle)' }}>{empresaName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-medium truncate max-w-[100px]" style={{ color: 'var(--color-text-muted)' }}>{userName}</span>
          <button
            onClick={logout}
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

      <nav
        className="fixed bottom-0 left-0 right-0 z-20 flex items-stretch"
        style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)' }}
      >
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/portal' ? pathname === '/portal' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors',
                active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-subtle)]',
              )}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
