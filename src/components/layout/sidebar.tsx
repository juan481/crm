'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Mail, Settings, LogOut, ChevronRight,
  Puzzle, Shield, X, CreditCard, UserCog, Tag, CalendarDays, FolderOpen,
  TrendingUp, CheckSquare, LifeBuoy, Calculator, CalendarCheck,
  Building2, UserCircle2, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import { Avatar } from '@/components/ui/avatar'
import Image from 'next/image'
import type { User } from '@/types'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles?: string[]
  exact?: boolean
}

const navItems: NavItem[] = [
  { label: 'Dashboard',      href: '/dashboard',      icon: <LayoutDashboard size={17} />, exact: true, roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'] },
  { label: 'Mi Día',         href: '/mi-dia',         icon: <CalendarCheck size={17} />,   exact: true, roles: ['TECHNICIAN'] },
  { label: 'Clientes',       href: '/clientes',       icon: <Users size={17} />,                        roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'] },
  { label: 'Pipeline',       href: '/pipeline',       icon: <TrendingUp size={17} />,                   roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'] },
  { label: 'Tareas',         href: '/tareas',         icon: <CheckSquare size={17} /> },
  { label: 'Cotizador',      href: '/cotizador',      icon: <Calculator size={17} /> },
  { label: 'Cotizaciones',   href: '/cotizaciones',   icon: <FileText size={17} />,  roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'] },
  { label: 'Tickets',        href: '/tickets',        icon: <LifeBuoy size={17} /> },
  { label: 'Eventos',        href: '/eventos',        icon: <CalendarDays size={17} />,                 roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'] },
  { label: 'Comunicaciones', href: '/comunicaciones', icon: <Mail size={17} />,                         roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'] },
  { label: 'Facturación',    href: '/facturas',       icon: <CreditCard size={17} />,                   roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Documentos',     href: '/documentos',     icon: <FolderOpen size={17} />,                   roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'] },
  { label: 'Empresas',       href: '/empresas',       icon: <Building2 size={17} />,                    roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'] },
  { label: 'Contactos',      href: '/contactos',      icon: <UserCircle2 size={17} />,                  roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'] },
]

const settingsItems: NavItem[] = [
  { label: 'Configuración', href: '/configuracion',           icon: <Settings size={16} />,  exact: true,  roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'] },
  { label: 'Usuarios',      href: '/configuracion/usuarios',  icon: <UserCog size={16} />,   exact: true,  roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Servicios',     href: '/configuracion/servicios', icon: <Tag size={16} />,        exact: true,  roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Email SMTP',    href: '/configuracion/correo',    icon: <Mail size={16} />,      exact: true,  roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Plugins',       href: '/configuracion/plugins',   icon: <Puzzle size={16} />,    exact: true,  roles: ['SUPER_ADMIN'] },
  { label: 'Marca',         href: '/configuracion/marca',     icon: <Shield size={16} />,    exact: true,  roles: ['SUPER_ADMIN'] },
]

interface SidebarProps {
  user: User
  crmName: string
  logoUrl: string | null
  mobile?: boolean
  onClose?: () => void
}

export function Sidebar({ user, crmName, logoUrl, mobile = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { logout } = useAuthStore()

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  const filteredNav = navItems.filter((item) => !item.roles || item.roles.includes(user.role))
  const filteredSettings = settingsItems.filter((item) => !item.roles || item.roles.includes(user.role))

  return (
    <aside
      className={cn('flex flex-col h-full border-r', mobile ? 'w-72' : 'w-64 hidden lg:flex')}
      style={{ background: '#0f172a', borderColor: 'rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center justify-between h-16 px-5 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Link href={user.role === 'TECHNICIAN' ? '/mi-dia' : '/dashboard'} className="flex items-center gap-3 group">
          {logoUrl ? (
            <Image src={logoUrl} alt={crmName} width={32} height={32} className="rounded-lg object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center text-white font-bold text-sm shrink-0">
              {crmName.charAt(0)}
            </div>
          )}
          <span className="font-semibold text-white text-sm tracking-tight">{crmName}</span>
        </Link>
        {mobile && (
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-white/8 transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        <div className="space-y-0.5">
          {filteredNav.map((item) => (
            <SidebarLink key={item.href} item={item} active={isActive(item)} onClose={onClose} />
          ))}
        </div>
        {filteredSettings.length > 0 && (
          <div className="pt-5 pb-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-widest mb-2"
              style={{ color: 'rgba(148,163,184,0.6)' }}>
              Configuración
            </p>
            {filteredSettings.map((item) => (
              <SidebarLink key={item.href} item={item} active={isActive(item)} onClose={onClose} />
            ))}
          </div>
        )}
      </nav>

      <div className="p-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3 p-2.5 rounded-xl group hover:bg-white/5 transition-colors cursor-pointer">
          <Avatar name={user.name} src={user.avatarUrl} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{user.name}</p>
            <p className="text-xs truncate" style={{ color: 'rgba(148,163,184,0.7)' }}>{user.email}</p>
          </div>
          <button onClick={logout}
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
            title="Cerrar sesión">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}

function SidebarLink({ item, active, onClose }: { item: NavItem; active: boolean; onClose?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative',
        active ? 'gradient-bg text-white shadow-glow' : 'hover:bg-white/6'
      )}
      style={!active ? { color: '#cbd5e1' } : undefined}
    >
      <span className={cn('shrink-0', active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300')}>
        {item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
      {active && <ChevronRight size={13} className="text-white/60" />}
    </Link>
  )
}
