'use client'

// Barra Rápida — 4 accesos directos + "Más", pensada para alguien que abre
// el CRM desde el celular para hacer UNA cosa puntual (fichar, cotizar,
// ver un cliente) y no quiere navegar un menú de 16 ítems para llegar.
//
// v2: las 4 acciones se ordenan por uso real de cada persona (ver
// src/lib/quick-actions.ts + /api/quick-actions/top|track) — ya no es el
// set fijo por rol de v1. Ese set curado sigue existiendo como
// QUICK_ACTION_DEFAULTS: es lo que ve alguien sin historial todavía (día 1)
// y lo que rellena los huecos si tiene menos de 4 acciones distintas
// usadas — nunca desaparece del todo, sólo deja de ser lo único posible.
//
// Íconos bicolor (fondo de un tono + ícono del color sólido encima) en vez
// de emoji — mismo criterio "profesional" que ya usan las tarjetas de
// estadísticas del Dashboard, reusando los MISMOS íconos de Lucide que ya
// representan cada pantalla en el sidebar (Fichar→Clock, Mi Día→
// CalendarCheck, etc.) para que el ícono signifique lo mismo en los dos
// lugares. "Más" reutiliza el mismo drawer del sidebar mobile de siempre.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Clock, CalendarCheck, LifeBuoy, ClipboardCheck, Calculator, Users,
  TrendingUp, Search, ClipboardList, CalendarClock, CheckSquare,
  LayoutDashboard, CreditCard, Mail, MoreHorizontal, Loader2,
  FileText, Building2, UserCircle2, FolderOpen, type LucideIcon,
} from 'lucide-react'
import { argentinaDayKey } from '@/lib/timezone'
import { getPositionSafe } from '@/lib/geolocation'
import { findOpenBlockClient } from '@/lib/asistencia-turnos'
import { invalidateFichaje } from '@/lib/asistencia-query-keys'
import { useSearchStore } from '@/store/search-store'
import { QUICK_ACTION_DEFAULTS } from '@/lib/quick-actions'
import type { Role } from '@/types'

interface TurnoHoy { id: string; fecha: string; horaEntrada: string | null; horaSalida: string | null; esPrincipal: boolean }

type Action =
  // exact: '/rrhh' y '/rrhh/turnos' son botones DISTINTOS acá (a diferencia
  // del sidebar, que sólo tiene el primero) — sin exact, estar en Turnos
  // prendía los dos tabs a la vez porque '/rrhh/turnos' arranca con '/rrhh'.
  | { icon: LucideIcon; label: string; kind: 'link'; href: string; exact?: boolean }
  | { icon: LucideIcon; label: string; kind: 'fichar' }
  | { icon: LucideIcon; label: string; kind: 'buscar' }

// Definición completa de CADA acción posible, indexada por actionKey — las
// mismas claves que usa src/lib/quick-actions.ts (pool + tracking). El
// server (GET /api/quick-actions/top) decide CUÁLES 4 mostrar según uso
// real de cada persona (v2) con fallback a QUICK_ACTION_DEFAULTS del mismo
// rol mientras no hay suficiente historial — acá sólo se resuelve
// actionKey → ícono/label/ruta para pintarlo. Mismos íconos que ya usa
// src/components/layout/sidebar.tsx para la misma pantalla, a propósito.
const ACTION_DEFS: Record<string, Action> = {
  fichar:         { icon: Clock,          label: 'Fichar',     kind: 'fichar' },
  buscar:         { icon: Search,         label: 'Buscar',     kind: 'buscar' },
  'mi-dia':       { icon: CalendarCheck,  label: 'Mi Día',     kind: 'link', href: '/mi-dia' },
  tickets:        { icon: LifeBuoy,       label: 'Tickets',    kind: 'link', href: '/tickets' },
  'mi-asistencia':{ icon: ClipboardCheck, label: 'Asistencia', kind: 'link', href: '/mi-asistencia' },
  tareas:         { icon: CheckSquare,    label: 'Tareas',     kind: 'link', href: '/tareas' },
  cotizador:      { icon: Calculator,     label: 'Cotizar',    kind: 'link', href: '/cotizador' },
  clientes:       { icon: Users,          label: 'Clientes',   kind: 'link', href: '/clientes' },
  pipeline:       { icon: TrendingUp,     label: 'Pipeline',   kind: 'link', href: '/pipeline' },
  cotizaciones:   { icon: FileText,       label: 'Cotiz.',     kind: 'link', href: '/cotizaciones' },
  empresas:       { icon: Building2,      label: 'Empresas',   kind: 'link', href: '/empresas' },
  contactos:      { icon: UserCircle2,    label: 'Contactos',  kind: 'link', href: '/contactos' },
  comunicaciones: { icon: Mail,           label: 'Campañas',   kind: 'link', href: '/comunicaciones' },
  documentos:     { icon: FolderOpen,     label: 'Documentos', kind: 'link', href: '/documentos' },
  rrhh:           { icon: ClipboardList,  label: 'RRHH',       kind: 'link', href: '/rrhh', exact: true },
  'rrhh-turnos':  { icon: CalendarClock,  label: 'Turnos',     kind: 'link', href: '/rrhh/turnos' },
  dashboard:      { icon: LayoutDashboard,label: 'Dashboard',  kind: 'link', href: '/dashboard' },
  facturas:       { icon: CreditCard,     label: 'Facturas',   kind: 'link', href: '/facturas' },
}

// Paleta bicolor del botón: fondo tenue + ícono sólido del mismo tono —
// mismo criterio que ya usan las tarjetas de estadísticas (bg 12-14% +
// color sólido encima), nunca un color plano ni un emoji.
type Tone = 'neutral' | 'primary' | 'good'
const TONE_STYLE: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--color-surface-raised)', fg: 'var(--color-text-muted)' },
  primary: { bg: 'rgba(99,102,241,0.14)',       fg: 'var(--color-primary)' },
  good:    { bg: 'rgba(16,185,129,0.14)',       fg: '#059669' },
}

interface Props {
  userId: string
  role: Role
  onMore: () => void
}

export function MobileQuickBar({ userId, role, onMore }: Props) {
  const pathname = usePathname()
  const qc = useQueryClient()
  const [ficharBusy, setFicharBusy] = useState(false)
  const setSearchOpen = useSearchStore(s => s.setOpen)

  // v2: 4 acciones ordenadas por uso real (ver src/lib/quick-actions.ts +
  // /api/quick-actions/top) en vez del set fijo por rol de v1. Mientras
  // carga, o si el server no devuelve nada usable (recién migrado, sin
  // historial todavía, o la llamada falló), cae al mismo set curado que
  // ya existía — nunca un flash de barra vacía ni "sin acciones".
  const { data: topKeys } = useQuery({
    queryKey: ['quick-actions-top', userId],
    queryFn: async () => {
      const r = await fetch('/api/quick-actions/top')
      if (!r.ok) return null
      return ((await r.json()).data ?? []) as string[]
    },
    staleTime: 60_000,
  })
  const resolvedKeys = topKeys && topKeys.length > 0 ? topKeys : (QUICK_ACTION_DEFAULTS[role] ?? [])
  const actions = resolvedKeys.map((key) => ACTION_DEFS[key]).filter((a): a is Action => !!a)

  const hoyKey = argentinaDayKey()
  const mesCurrent = hoyKey.slice(0, 7)

  // Misma queryKey que attendance-widget.tsx/mi-dia/mi-asistencia — comparte
  // caché, así que esto no dispara un fetch extra si alguna ya la tiene
  // cargada. Sólo hace falta el mes acá: el botón "Fichar" únicamente
  // necesita saber si hay un bloque ABIERTO (de hoy o de un día anterior
  // — ver findOpenBlockClient), no el detalle de horario/tardanza que sí
  // usa el widget del header.
  const { data: turnosMes } = useQuery({
    queryKey: ['turnos-hoy', userId],
    queryFn: async () => {
      const r = await fetch(`/api/asistencia/turnos?userId=${userId}&mes=${mesCurrent}`)
      if (!r.ok) return []
      return ((await r.json()).data ?? []) as TurnoHoy[]
    },
    staleTime: 30_000,
    enabled: actions.some(a => a.kind === 'fichar'),
  })
  const openBlock = findOpenBlockClient(turnosMes ?? [])

  // No hay ninguna acción resuelta para este rol (no debería pasar — hasta
  // sin historial, resolvedKeys cae a QUICK_ACTION_DEFAULTS — pero si
  // mañana se agrega un rol nuevo sin sumarlo a ese mapa, la barra
  // simplemente no se renderiza en vez de mostrarse vacía salvo "Más").
  if (actions.length === 0) return null

  // Fire-and-forget — mismo criterio que el tracking de rutas en
  // app-shell.tsx, pero para las dos acciones que NO son una navegación
  // (fichar/buscar no cambian el pathname, así que ese efecto nunca las ve).
  const track = (actionKey: string) => {
    fetch('/api/quick-actions/track', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionKey }),
    }).catch(() => {})
  }

  const handleFichar = async () => {
    if (ficharBusy) return
    setFicharBusy(true)
    track('fichar')
    try {
      const pos = await getPositionSafe()
      const endpoint = openBlock ? '/api/asistencia/check-out' : '/api/asistencia/check-in'
      const body = openBlock
        ? { lat: pos?.lat, lng: pos?.lng }
        : { modalidad: 'Presencial', lat: pos?.lat, lng: pos?.lng }
      const res  = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al fichar'); return }
      if (openBlock) toast.success(`Hasta luego — trabajaste ${json.horasTrabajadas}`)
      else toast.success(json.tardanza ? '⚠️ Entrada registrada con tardanza' : '✅ Entrada registrada')
    } catch {
      toast.error('Error de conexión')
    } finally {
      // Se invalida SIEMPRE, no sólo en éxito — mismo motivo que el 409
      // de attendance-widget.tsx llama a refreshEverywhere(): si `openBlock`
      // (turnos-hoy en caché) estaba desactualizado — por ejemplo, se
      // fichó desde otra pestaña/pantalla un segundo antes — el server
      // responde 409/400 y sin refrescar acá el botón queda mostrando
      // "Fichar"/"Salida" desactualizado, repitiendo el mismo error hasta
      // que venza el staleTime de 30s solo. Invalidar siempre autocorrige
      // el estado apenas se resuelve el request, haya salido bien o mal.
      invalidateFichaje(qc)
      setFicharBusy(false)
    }
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  return (
    <nav
      // z-20, no z-30/z-40: esos dos ya los usa el overlay/drawer del
      // sidebar mobile en app-shell.tsx — con el mismo z-30 que el fondo
      // oscuro, esta barra (que se monta después en el DOM) quedaba
      // pintada ARRIBA del overlay y seguía tocable con el drawer "Más"
      // abierto. Con z-20 queda tapada por el overlay mientras el drawer
      // está abierto, como el resto del contenido de la página.
      className="lg:hidden fixed inset-x-0 bottom-0 z-20 flex items-stretch gap-0.5 px-1.5 pt-1.5"
      style={{
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {actions.map((a) => {
        const active = a.kind === 'link' && isActive(a.href, a.exact)
        const tone: Tone = a.kind === 'fichar' ? (openBlock ? 'good' : 'neutral') : active ? 'primary' : 'neutral'
        const Icon = a.kind === 'fichar' && ficharBusy ? Loader2 : a.icon
        const label = a.kind === 'fichar' ? (openBlock ? 'Salida' : 'Fichar') : a.label
        const spinning = a.kind === 'fichar' && ficharBusy

        if (a.kind === 'link') {
          return (
            <QuickBarButton key={a.label} as="link" href={a.href} icon={Icon} label={label} tone={tone} />
          )
        }
        if (a.kind === 'fichar') {
          return (
            <QuickBarButton key={a.label} as="button" onClick={handleFichar} disabled={ficharBusy}
              icon={Icon} label={label} tone={tone} spin={spinning} />
          )
        }
        return (
          <QuickBarButton key={a.label} as="button" onClick={() => { track('buscar'); setSearchOpen(true) }}
            icon={Icon} label={label} tone={tone} />
        )
      })}
      <QuickBarButton as="button" onClick={onMore} icon={MoreHorizontal} label="Más" tone="neutral" />
    </nav>
  )
}

// Botón individual — aislado en su propio componente para que la animación
// de "toque" (pop elástico del ícono, ya que en mobile no existe :hover)
// tenga su propio estado y no re-renderice toda la barra en cada tap.
function QuickBarButton(props: {
  icon: LucideIcon
  label: string
  tone: Tone
  spin?: boolean
  disabled?: boolean
} & (
  | { as: 'link'; href: string }
  | { as: 'button'; onClick: () => void }
)) {
  const { icon: Icon, label, tone, spin, disabled } = props
  const [popping, setPopping] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { bg, fg } = TONE_STYLE[tone]

  const pop = () => {
    // Reinicia la animación aunque se toque muy seguido: si ya estaba
    // "popping", sacar y volver a poner la clase en el mismo tick no
    // reinicia el keyframe en CSS — por eso pasa por un frame en `false`.
    setPopping(false)
    requestAnimationFrame(() => setPopping(true))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setPopping(false), 380)
  }

  const content = (
    <>
      <span
        className={`flex items-center justify-center w-8 h-8 rounded-[10px] transition-colors duration-200 ${popping ? 'qb-pop' : ''}`}
        style={{ background: bg, color: fg }}
      >
        <Icon size={17} strokeWidth={2.25} className={spin ? 'animate-spin' : ''} />
      </span>
      <span className="text-[9.5px] font-bold tracking-tight transition-colors duration-200" style={{ color: tone === 'neutral' ? 'var(--color-text-subtle)' : fg }}>
        {label}
      </span>
    </>
  )

  // globals.css ya pone -webkit-tap-highlight-color: transparent en todo
  // button/a/[role=button] del sistema — no hace falta repetirlo acá.
  const className = 'flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl select-none'

  if (props.as === 'link') {
    return (
      <Link href={props.href} onClick={pop} className={className}>
        {content}
      </Link>
    )
  }
  return (
    <button onClick={() => { pop(); props.onClick() }} disabled={disabled} className={className}>
      {content}
    </button>
  )
}
