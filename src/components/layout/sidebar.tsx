'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, Mail, Settings, LogOut, ChevronRight,
  Puzzle, Shield, X, CreditCard, UserCog, Tag, CalendarDays, FolderOpen,
  TrendingUp, CheckSquare, Headphones,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import { useThemeStore } from '@/store/theme-store'
import { Avatar } from '@/components/ui/avatar'
import Image from 'next/image'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles?: string[]
  badge?: string
  exact?: boolean
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={18} />, exact: true },
  { label: 'Clientes', href: '/clientes', icon: <Users size={18} /> },
  { label: 'Pipeline', href: '/pipeline', icon: <TrendingUp size={18} /> },
  { label: 'Tareas', href: '/tareas', icon: <CheckSquare size={18} /> },
  { label: 'Tickets', href: '/tickets', icon: <Headphones size={18} /> },
  { label: 'Eventos', href: '/eventos', icon: <CalendarDays size={18} /> },
  { label: 'Comunicaciones', href: '/comunicaciones', icon: <Mail size={18} /> },
  { label: 'Facturación', href: '/facturas', icon: <CreditCard size={18} /> },
  { label: 'Documentos', href: '/documentos', icon: <FolderOpen size={18} /> },
]

const settingsItems: NavItem[] = [
  { label: 'Configuración', href: '/configuracion', icon: <Settings size={18} />, exact: true },
  { label: 'Usuarios', href: '/configuracion/usuarios', icon: <UserCog size={18} />, roles: ['SUPER_ADMIN', 'ADMIN'], exact: true },
  { label: 'Servicios', href: '/configuracion/servicios', icon: <Tag size={18} />, roles: ['SUPER_ADMIN', 'ADMIN'], exact: true },
  { label: 'Email SMTP', href: '/configuracion/correo', icon: <Mail size={18} />, roles: ['SUPER_ADMIN', 'ADMIN'], exact: true },
  { label: 'Plugins', href: '/configuracion/plugins', icon: <Puzzle size={18} />, roles: ['SUPER_ADMIN'], exact: true },
  { label: 'Marca Blanca', href: '/configuracion/marca', icon: <Shield size={18} />, roles: ['SUPER_ADMIN'], exact: true },
]

interface SidebarProps {
  mobile?: boolean
  onClose?: () => void
}

export function Sidebar({ mobile = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const { crmName, logoUrl } = useThemeStore()

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  const filteredSettings = settingsItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  )

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-[var(--color-surface)] border-r border-[var(--color-border)]',
        mobile ? 'w-72' : 'w-64 hidden lg:flex'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-[var(--color-border)] shrink-0">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          {logoUrl ? (
            <Image src={logoUrl} alt={crmName} width={32} height={32} className="rounded-lg object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center text-white font-bold text-sm">
              {crmName.charAt(0)}
            </div>
          )}
          <span className="font-semibold text-[var(--color-text)] text-sm tracking-tight group-hover:gradient-text transition-all">
            {crmName}
          </span>
        </Link>
        {mobile && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        <div className="space-y-0.5">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item)} onClose={onClose} />
          ))}
        </div>

        <div className="pt-4 pb-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-subtle)] mb-1">
            Configuración
          </p>
          {filteredSettings.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item)} onClose={onClose} />
          ))}
        </div>
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-[var(--color-border)] shrink-0">
        <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--color-surface-raised)] transition-colors group cursor-pointer">
          <Avatar name={user?.name ?? 'U'} src={user?.avatarUrl} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-text)] truncate">{user?.name}</p>
            <p className="text-xs text-[var(--color-text-muted)] truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
            title="Cerrar sesión"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}

function NavLink({
  item,
  active,
  onClose,
}: {
  item: NavItem
  active: boolean
  onClose?: () => void
}) {
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative',
        active
          ? 'gradient-bg text-white shadow-glow'
          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]'
      )}
    >
      <span className={cn('shrink-0', active ? 'text-white' : 'text-[var(--color-text-subtle)] group-hover:text-[var(--color-primary)]')}>
        {item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded-full font-semibold">
          {item.badge}
        </span>
      )}
      {active && (
        <ChevronRight size={14} className="text-white/70" />
      )}
    </Link>
  )
}
