'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, Users, TrendingUp, CheckSquare, Calculator,
  Headphones, CalendarDays, Mail, CreditCard, FolderOpen,
  Settings, LogOut, Sun, Moon, Bell, Search, Menu, X,
  AlertCircle, AlertTriangle, Info, CalendarCheck, ChevronDown,
  Shield, UserCog, Tag, Puzzle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import { useThemeStore } from '@/store/theme-store'
import { Avatar } from '@/components/ui/avatar'
import type { Client } from '@/types'
import type { AppNotification } from '@/app/api/notifications/route'

/* ── Nav items ───────────────────────────────────────────────────────────── */
interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles?: string[]
  exact?: boolean
}

const primaryNav: NavItem[] = [
  { label: 'Dashboard',      href: '/dashboard',      icon: <LayoutDashboard size={16} />, exact: true, roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'] },
  { label: 'Mi Día',         href: '/mi-dia',         icon: <CalendarCheck size={16} />,   exact: true, roles: ['TECHNICIAN'] },
  { label: 'Clientes',       href: '/clientes',       icon: <Users size={16} />,                        roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'] },
  { label: 'Pipeline',       href: '/pipeline',       icon: <TrendingUp size={16} />,                   roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'] },
  { label: 'Tareas',         href: '/tareas',         icon: <CheckSquare size={16} /> },
  { label: 'Cotizador',      href: '/cotizador',      icon: <Calculator size={16} /> },
  { label: 'Tickets',        href: '/tickets',        icon: <Headphones size={16} /> },
]

const secondaryNav: NavItem[] = [
  { label: 'Eventos',        href: '/eventos',        icon: <CalendarDays size={16} />, roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'] },
  { label: 'Comunicaciones', href: '/comunicaciones', icon: <Mail size={16} />,         roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'] },
  { label: 'Facturación',    href: '/facturas',       icon: <CreditCard size={16} />,   roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Documentos',     href: '/documentos',     icon: <FolderOpen size={16} />,   roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'] },
]

const settingsNav: NavItem[] = [
  { label: 'Configuración',  href: '/configuracion',          icon: <Settings size={15} />, exact: true, roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'] },
  { label: 'Usuarios',       href: '/configuracion/usuarios', icon: <UserCog size={15} />,  exact: true, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Servicios',      href: '/configuracion/servicios',icon: <Tag size={15} />,      exact: true, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Email SMTP',     href: '/configuracion/correo',   icon: <Mail size={15} />,     exact: true, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Plugins',        href: '/configuracion/plugins',  icon: <Puzzle size={15} />,   exact: true, roles: ['SUPER_ADMIN'] },
  { label: 'Marca',          href: '/configuracion/marca',    icon: <Shield size={15} />,   exact: true, roles: ['SUPER_ADMIN'] },
]

function useIsActive(item: NavItem) {
  const pathname = usePathname()
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

function NavLink({ item, onClick, size = 'md' }: { item: NavItem; onClick?: () => void; size?: 'sm' | 'md' }) {
  const active = useIsActive(item)
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 font-medium transition-all duration-150 whitespace-nowrap rounded-xl',
        size === 'md'
          ? 'px-3 py-2 text-sm'
          : 'px-3 py-2.5 text-sm',
        active
          ? 'gradient-bg text-white shadow-glow'
          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]'
      )}
    >
      <span className={active ? 'text-white' : 'text-[var(--color-text-subtle)]'}>
        {item.icon}
      </span>
      {item.label}
    </Link>
  )
}

/* ── TopNav component ────────────────────────────────────────────────────── */
export function TopNav() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, logout } = useAuthStore()
  const { darkMode, toggleDarkMode, crmName, logoUrl } = useThemeStore()

  const [mobileOpen, setMobileOpen]   = useState(false)
  const [moreOpen, setMoreOpen]       = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [userOpen, setUserOpen]       = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen]   = useState(false)
  const [notifOpen, setNotifOpen]     = useState(false)

  const moreRef    = useRef<HTMLDivElement>(null)
  const settRef    = useRef<HTMLDivElement>(null)
  const userRef    = useRef<HTMLDivElement>(null)
  const searchRef  = useRef<HTMLDivElement>(null)
  const notifRef   = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current  && !moreRef.current.contains(e.target as Node))   setMoreOpen(false)
      if (settRef.current  && !settRef.current.contains(e.target as Node))   setSettingsOpen(false)
      if (userRef.current  && !userRef.current.contains(e.target as Node))   setUserOpen(false)
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node))  setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Queries
  const { data: searchResults } = useQuery({
    queryKey: ['search', searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return []
      const res = await fetch(`/api/clients?search=${encodeURIComponent(searchQuery)}&limit=6`)
      if (!res.ok) return []
      const json = await res.json()
      return (json.data ?? []) as Client[]
    },
    enabled: searchQuery.length >= 2,
    staleTime: 30 * 1000,
  })

  const { data: notifData } = useQuery<{ data: AppNotification[] }>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications')
      if (!res.ok) return { data: [] }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })

  const notifications = notifData?.data ?? []
  const unreadCount   = notifications.length

  const filterByRole = (items: NavItem[]) =>
    items.filter(i => !i.roles || (user && i.roles.includes(user.role)))

  const primary   = filterByRole(primaryNav)
  const secondary = filterByRole(secondaryNav)
  const settings  = filterByRole(settingsNav)

  const severityIcon = (s: string) => {
    if (s === 'danger')  return <AlertCircle  size={14} className="text-red-400  shrink-0" />
    if (s === 'warning') return <AlertTriangle size={14} className="text-amber-400 shrink-0" />
    return <Info size={14} className="text-blue-400 shrink-0" />
  }

  return (
    <>
      {/* ── Main nav bar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 h-14 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center gap-3 px-4 lg:px-6">
        {/* Logo */}
        <Link
          href={user?.role === 'TECHNICIAN' ? '/mi-dia' : '/dashboard'}
          className="flex items-center gap-2.5 shrink-0 mr-2"
        >
          {logoUrl ? (
            <Image src={logoUrl} alt={crmName} width={28} height={28} className="rounded-lg object-contain" />
          ) : (
            <div className="w-7 h-7 rounded-lg gradient-bg flex items-center justify-center text-white font-bold text-xs shrink-0">
              {crmName.charAt(0)}
            </div>
          )}
          <span className="font-bold text-[var(--color-text)] text-sm tracking-tight hidden sm:block">
            {crmName}
          </span>
        </Link>

        {/* Divider */}
        <div className="h-6 w-px bg-[var(--color-border)] shrink-0 hidden lg:block" />

        {/* Primary nav — desktop */}
        <nav className="hidden lg:flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-none">
          {primary.map(item => <NavLink key={item.href} item={item} />)}

          {/* "Más" dropdown */}
          {secondary.length > 0 && (
            <div ref={moreRef} className="relative shrink-0">
              <button
                onClick={() => setMoreOpen(v => !v)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all',
                  moreOpen
                    ? 'bg-[var(--color-surface-raised)] text-[var(--color-text)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]'
                )}
              >
                Más <ChevronDown size={14} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              {moreOpen && (
                <div className="absolute left-0 top-full mt-1 w-52 bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)] rounded-2xl shadow-modal overflow-hidden z-50 py-1">
                  {secondary.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text)] transition-colors"
                    >
                      <span className="text-[var(--color-text-subtle)]">{item.icon}</span>
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-1 ml-auto">
          {/* Search */}
          <div ref={searchRef} className="relative">
            {searchOpen ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--color-primary)] bg-[var(--color-surface-raised)] w-56 shadow-[0_0_0_3px_var(--color-primary-light)]">
                <Search size={14} className="text-[var(--color-primary)] shrink-0" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Buscar clientes..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] outline-none focus:outline-none min-w-0"
                />
                <button onClick={() => { setSearchOpen(false); setSearchQuery('') }}>
                  <X size={13} className="text-[var(--color-text-subtle)] hover:text-[var(--color-text)]" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)] transition-all"
              >
                <Search size={17} />
              </button>
            )}
            {/* Search results */}
            {searchOpen && searchQuery.length >= 2 && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)] rounded-2xl shadow-modal overflow-hidden z-50">
                {!searchResults || searchResults.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-[var(--color-text-muted)] text-center">Sin resultados</p>
                ) : (
                  <ul>
                    {searchResults.map(client => (
                      <li key={client.id}>
                        <button
                          onClick={() => { router.push(`/clientes/${client.id}`); setSearchOpen(false); setSearchQuery('') }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-surface-overlay)] transition-colors text-left"
                        >
                          <div className="w-7 h-7 rounded-lg gradient-bg flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {client.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--color-text)] truncate">{client.name}</p>
                            <p className="text-xs text-[var(--color-text-muted)] truncate">{client.email}</p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Dark mode */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)] transition-all"
            title="Cambiar tema"
          >
            {darkMode ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setNotifOpen(v => !v)}
              className="p-2 rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)] transition-all relative"
            >
              <Bell size={17} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full mt-1 w-80 bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)] rounded-2xl shadow-modal overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                  <p className="text-sm font-semibold text-[var(--color-text)]">Notificaciones</p>
                  {unreadCount > 0 && (
                    <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-medium">
                      {unreadCount}
                    </span>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Bell size={22} className="mx-auto mb-2 text-[var(--color-text-subtle)]" />
                    <p className="text-sm text-[var(--color-text-muted)]">Sin alertas</p>
                  </div>
                ) : (
                  <ul className="max-h-72 overflow-y-auto divide-y divide-[var(--color-border)]">
                    {notifications.map(n => (
                      <li key={n.id}>
                        <Link
                          href={n.href}
                          onClick={() => setNotifOpen(false)}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-surface-overlay)] transition-colors"
                        >
                          {severityIcon(n.severity)}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[var(--color-text)]">{n.title}</p>
                            <p className="text-xs text-[var(--color-text-muted)] truncate">{n.body}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Settings dropdown — desktop */}
          {settings.length > 0 && (
            <div ref={settRef} className="relative hidden lg:block">
              <button
                onClick={() => setSettingsOpen(v => !v)}
                className="p-2 rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)] transition-all"
                title="Configuración"
              >
                <Settings size={17} />
              </button>
              {settingsOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)] rounded-2xl shadow-modal overflow-hidden z-50 py-1">
                  <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
                    Configuración
                  </p>
                  {settings.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSettingsOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text)] transition-colors"
                    >
                      <span className="text-[var(--color-text-subtle)]">{item.icon}</span>
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* User menu */}
          <div ref={userRef} className="relative">
            <button
              onClick={() => setUserOpen(v => !v)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-[var(--color-surface-raised)] transition-all"
            >
              <Avatar name={user?.name ?? 'U'} src={user?.avatarUrl} size="sm" />
              <span className="text-xs font-medium text-[var(--color-text)] hidden sm:block max-w-[80px] truncate">
                {user?.name?.split(' ')[0]}
              </span>
              <ChevronDown size={13} className="text-[var(--color-text-subtle)] hidden sm:block" />
            </button>
            {userOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)] rounded-2xl shadow-modal overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-[var(--color-border)]">
                  <p className="text-sm font-semibold text-[var(--color-text)] truncate">{user?.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)] truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { setUserOpen(false); logout() }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/8 transition-colors"
                >
                  <LogOut size={14} />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="lg:hidden p-2 rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] transition-all"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* ── Mobile nav drawer ─────────────────────────────────────────── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed top-14 left-0 right-0 z-40 lg:hidden bg-[var(--color-surface)] border-b border-[var(--color-border)] shadow-modal max-h-[80vh] overflow-y-auto">
            <nav className="p-3 space-y-0.5">
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
                Navegación
              </p>
              {[...primary, ...secondary].map(item => (
                <NavLink key={item.href} item={item} onClick={() => setMobileOpen(false)} size="sm" />
              ))}
              {settings.length > 0 && (
                <>
                  <div className="h-px bg-[var(--color-border)] my-2" />
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
                    Configuración
                  </p>
                  {settings.map(item => (
                    <NavLink key={item.href} item={item} onClick={() => setMobileOpen(false)} size="sm" />
                  ))}
                </>
              )}
              <div className="h-px bg-[var(--color-border)] my-2" />
              <button
                onClick={() => { setMobileOpen(false); logout() }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/8 transition-colors"
              >
                <LogOut size={15} />
                Cerrar sesión
              </button>
            </nav>
          </div>
        </>
      )}
    </>
  )
}
