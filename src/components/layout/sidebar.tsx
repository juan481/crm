'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Mail, Settings, LogOut, ChevronRight, ChevronsUpDown, Check,
  Puzzle, Shield, X, CreditCard, UserCog, Tag, CalendarDays, FolderOpen,
  TrendingUp, CheckSquare, LifeBuoy, Calculator, CalendarCheck, ClipboardCheck,
  Building2, UserCircle2, FileText, ClipboardList, KeyRound,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import { Avatar } from '@/components/ui/avatar'
import Image from 'next/image'
import type { User } from '@/types'
import type { NotificationCounts } from '@/app/api/notifications/counts/route'

interface SessionOrg {
  id: string
  name: string
  logoUrl: string | null
  isActive: boolean
}

interface ModulePermissionRow {
  id: string
  roles: Record<string, boolean>
}

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles?: string[]
  // Rubros (src/lib/verticals.ts) que ven este ítem. Sin declarar = visible
  // para todos — así ningún módulo existente le cambia nada a Abba.
  verticals?: string[]
  // Id en src/lib/modules.ts MODULE_DEFINITIONS — habilita el filtro extra
  // por ModulePermission (Configuración > Permisos). Sin declarar = no pasa
  // por ese filtro (los settingsItems no lo llevan a propósito).
  moduleId?: string
  exact?: boolean
  badgeKey?: keyof NotificationCounts
}

const navItems: NavItem[] = [
  { label: 'Dashboard',      href: '/dashboard',        icon: <LayoutDashboard size={17} />, exact: true, roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'], moduleId: 'dashboard' },
  { label: 'Mi Día',         href: '/mi-dia',           icon: <CalendarCheck size={17} />,   exact: true, roles: ['TECHNICIAN'], moduleId: 'mi-dia' },
  { label: 'Clientes',       href: '/clientes',         icon: <Users size={17} />,                        roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'], moduleId: 'clientes' },
  { label: 'Pipeline',       href: '/pipeline',         icon: <TrendingUp size={17} />,                   roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'], moduleId: 'pipeline' },
  { label: 'Tareas',         href: '/tareas',           icon: <CheckSquare size={17} />,                  roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER', 'TECHNICIAN', 'HR'], badgeKey: 'tasks', moduleId: 'tareas' },
  { label: 'Cotizador',      href: '/cotizador',        icon: <Calculator size={17} />,                   roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'], moduleId: 'cotizador' },
  { label: 'Cotizaciones',   href: '/cotizaciones',     icon: <FileText size={17} />,                     roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'], moduleId: 'cotizaciones' },
  { label: 'Tickets',        href: '/tickets',          icon: <LifeBuoy size={17} />,                     roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER', 'TECHNICIAN'], badgeKey: 'tickets', moduleId: 'tickets' },
  { label: 'Eventos',        href: '/eventos',          icon: <CalendarDays size={17} />,                 roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER', 'TECHNICIAN'], moduleId: 'eventos' },
  { label: 'Comunicaciones', href: '/comunicaciones',   icon: <Mail size={17} />,                         roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'], moduleId: 'comunicaciones' },
  { label: 'Facturación',    href: '/facturas',         icon: <CreditCard size={17} />,                   roles: ['SUPER_ADMIN', 'ADMIN'], badgeKey: 'invoices', moduleId: 'facturas' },
  { label: 'Documentos',     href: '/documentos',       icon: <FolderOpen size={17} />,                   roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'], moduleId: 'documentos' },
  { label: 'Empresas',       href: '/empresas',         icon: <Building2 size={17} />,                    roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'], moduleId: 'empresas' },
  { label: 'Contactos',      href: '/contactos',        icon: <UserCircle2 size={17} />,                  roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER'], moduleId: 'contactos' },
  { label: 'RRHH',           href: '/rrhh',             icon: <ClipboardList size={17} />,                roles: ['SUPER_ADMIN', 'ADMIN', 'HR'], moduleId: 'rrhh' },
  { label: 'Mi Asistencia',  href: '/mi-asistencia',    icon: <ClipboardCheck size={17} />,               roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER', 'TECHNICIAN', 'HR'], moduleId: 'mi-asistencia' },
]

const settingsItems: NavItem[] = [
  { label: 'Configuración', href: '/configuracion',           icon: <Settings size={16} />,  exact: true,  roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Usuarios',      href: '/configuracion/usuarios',  icon: <UserCog size={16} />,   exact: true,  roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Permisos',      href: '/configuracion/permisos',  icon: <KeyRound size={16} />,  exact: true,  roles: ['SUPER_ADMIN'] },
  { label: 'Servicios',     href: '/configuracion/servicios', icon: <Tag size={16} />,        exact: true,  roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Email SMTP',    href: '/configuracion/correo',    icon: <Mail size={16} />,      exact: true,  roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Plugins',       href: '/configuracion/plugins',   icon: <Puzzle size={16} />,    exact: true,  roles: ['SUPER_ADMIN'] },
  { label: 'Marca',         href: '/configuracion/marca',     icon: <Shield size={16} />,    exact: true,  roles: ['SUPER_ADMIN'] },
]

interface SidebarProps {
  user: User
  crmName: string
  logoUrl: string | null
  vertical?: string | null
  mobile?: boolean
  onClose?: () => void
}

export function Sidebar({ user, crmName, logoUrl, vertical = null, mobile = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { logout } = useAuthStore()

  const { data: counts } = useQuery<NotificationCounts>({
    queryKey: ['notification-counts'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/counts')
      const json = await res.json()
      return json.data ?? { tasks: 0, tickets: 0, invoices: 0 }
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })

  // Sólo pega este fetch a la red para gente con más de una organización —
  // el resultado siempre tiene largo 1 para el resto, así que el switcher
  // nunca se renderiza y esto es indistinguible de no tener la feature.
  const { data: orgs } = useQuery<SessionOrg[]>({
    queryKey: ['session-organizations'],
    queryFn: async () => {
      const res = await fetch('/api/session/organizations')
      const json = await res.json()
      return json.data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })

  // Configuración > Permisos — visibilidad de nav configurable por rol. Sólo
  // puede RESTAR sobre lo que `roles`/`verticals` ya permiten (ver
  // isModuleAllowed abajo), nunca reemplazarlos. Si todavía no resolvió o
  // falló, isModuleAllowed cae a "permitido" — un hiccup de red nunca vacía
  // el sidebar.
  const { data: modulePerms } = useQuery<ModulePermissionRow[]>({
    queryKey: ['module-permissions'],
    queryFn: async () => {
      const res = await fetch('/api/module-permissions')
      const json = await res.json()
      return json.data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  const matchesVertical = (item: NavItem) =>
    !item.verticals || (vertical !== null && item.verticals.includes(vertical))

  const isModuleAllowed = (item: NavItem) => {
    if (!item.moduleId) return true
    const row = modulePerms?.find((m) => m.id === item.moduleId)
    if (!row) return true
    return row.roles[user.role] !== false
  }

  const filteredNav = navItems
    .filter((item) => !item.roles || item.roles.includes(user.role))
    .filter(matchesVertical)
    .filter(isModuleAllowed)
  const filteredSettings = settingsItems
    .filter((item) => !item.roles || item.roles.includes(user.role))
    .filter(matchesVertical)

  return (
    <aside
      className={cn('flex flex-col h-full border-r', mobile ? 'w-72' : 'w-64 hidden lg:flex')}
      style={{ background: '#0f172a', borderColor: 'rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center justify-between h-16 px-5 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Link href={user.role === 'TECHNICIAN' ? '/mi-dia' : user.role === 'HR' ? '/rrhh' : '/dashboard'} className="flex items-center gap-3 group">
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

      {/* Sólo aparece si el usuario tiene acceso a más de una organización
          (ver OrganizationMembership) — para todo el resto, `orgs` siempre
          tiene largo <= 1 y este bloque no renderiza nada. */}
      {orgs && orgs.length > 1 && <OrgSwitcher orgs={orgs} />}

      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        <div className="space-y-0.5">
          {filteredNav.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              active={isActive(item)}
              onClose={onClose}
              badge={item.badgeKey ? (counts?.[item.badgeKey] ?? 0) : 0}
            />
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

function SidebarLink({
  item, active, onClose, badge = 0,
}: {
  item: NavItem; active: boolean; onClose?: () => void; badge?: number
}) {
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
      {badge > 0 && !active && (
        <span
          className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center leading-none"
          style={{ background: '#ef4444', color: '#fff' }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      {active && <ChevronRight size={13} className="text-white/60" />}
    </Link>
  )
}

// Sólo se monta cuando `orgs.length > 1` — ver Sidebar arriba. Cambiar de
// organización hace un POST que valida membership server-side y recién ahí
// una recarga DURA (no router.push) a propósito: vacía cualquier caché de
// React Query / estado en memoria que haya quedado de la organización
// anterior, para no arriesgar un flash con datos mezclados.
function OrgSwitcher({ orgs }: { orgs: SessionOrg[] }) {
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = orgs.find((o) => o.isActive) ?? orgs[0]

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const switchTo = async (org: SessionOrg) => {
    if (org.isActive || switching) { setOpen(false); return }
    setSwitching(true)
    try {
      const res = await fetch('/api/session/active-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: org.id }),
      })
      if (!res.ok) { setSwitching(false); return }
      window.location.href = '/dashboard'
    } catch {
      setSwitching(false)
    }
  }

  return (
    <div ref={ref} className="relative px-3 pt-3 shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors hover:bg-white/6 disabled:opacity-60"
      >
        {current?.logoUrl ? (
          <Image src={current.logoUrl} alt={current.name} width={22} height={22} className="rounded-md object-contain shrink-0" />
        ) : (
          <div className="w-[22px] h-[22px] rounded-md gradient-bg flex items-center justify-center text-white text-[10px] font-bold shrink-0">
            {current?.name.charAt(0)}
          </div>
        )}
        <span className="flex-1 min-w-0 text-xs font-medium text-slate-200 truncate">{current?.name}</span>
        <ChevronsUpDown size={13} className="text-slate-500 shrink-0" />
      </button>

      {open && (
        <div
          className="absolute left-3 right-3 mt-1 rounded-xl shadow-xl overflow-hidden z-20 py-1"
          style={{ background: '#1a2233', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => switchTo(org)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/6 transition-colors"
            >
              {org.logoUrl ? (
                <Image src={org.logoUrl} alt={org.name} width={20} height={20} className="rounded-md object-contain shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-md gradient-bg flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                  {org.name.charAt(0)}
                </div>
              )}
              <span className="flex-1 min-w-0 text-xs font-medium text-slate-200 truncate">{org.name}</span>
              {org.isActive && <Check size={13} className="text-emerald-400 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
