'use client'

// Barra Rápida — 4 accesos directos con emoji + "Más", pensada para
// alguien que abre el CRM desde el celular para hacer UNA cosa puntual
// (fichar, cotizar, ver un cliente) y no quiere navegar un menú de 16
// ítems para llegar. El set de 4 es fijo por rol (v1, confirmado con
// Juan) — un ajuste automático según el uso real de cada persona queda
// como mejora futura, no es parte de esta tanda.
//
// "Más" reutiliza el mismo drawer del sidebar mobile que ya existe
// (onMore = abrir ese mismo panel) — no es un menú nuevo, es la
// "versión completa" de siempre a un toque de distancia.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { argentinaDayKey } from '@/lib/timezone'
import { getPositionSafe } from '@/lib/geolocation'
import { invalidateFichaje } from '@/lib/asistencia-query-keys'
import { useSearchStore } from '@/store/search-store'
import type { Role } from '@/types'

interface AsistenciaHoy { fecha: string; horaEntrada: string | null; horaSalida: string | null; tardanza: boolean }
interface TurnoHoy { id: string; fecha: string; horaEntrada: string | null; horaSalida: string | null; esPrincipal: boolean }

type Action =
  // exact: '/rrhh' y '/rrhh/turnos' son botones DISTINTOS acá (a diferencia
  // del sidebar, que sólo tiene el primero) — sin exact, estar en Turnos
  // prendía los dos tabs a la vez porque '/rrhh/turnos' arranca con '/rrhh'.
  | { emoji: string; label: string; kind: 'link'; href: string; exact?: boolean }
  | { emoji: string; label: string; kind: 'fichar' }
  | { emoji: string; label: string; kind: 'buscar' }
  | { emoji: string; label: string; kind: 'more' }

// Sets curados a mano por rol — cada uno son las 4 pantallas/acciones que
// esa persona toca más seguido en el uso real de Abba (confirmado con
// Juan). SUPER_ADMIN comparte el de ADMIN — a esta granularidad no hay
// necesidad de diferenciarlos, igual que el resto del nav.
const QUICK_ACTIONS: Partial<Record<Role, Action[]>> = {
  TECHNICIAN: [
    { emoji: '🕐', label: 'Fichar', kind: 'fichar' },
    { emoji: '📋', label: 'Mi Día', kind: 'link', href: '/mi-dia' },
    { emoji: '🎫', label: 'Tickets', kind: 'link', href: '/tickets' },
    { emoji: '📅', label: 'Asistencia', kind: 'link', href: '/mi-asistencia' },
  ],
  SELLER: [
    { emoji: '💰', label: 'Cotizar', kind: 'link', href: '/cotizador' },
    { emoji: '🏢', label: 'Clientes', kind: 'link', href: '/clientes' },
    { emoji: '📊', label: 'Pipeline', kind: 'link', href: '/pipeline' },
    { emoji: '🔍', label: 'Buscar', kind: 'buscar' },
  ],
  HR: [
    { emoji: '🕐', label: 'Fichar', kind: 'fichar' },
    { emoji: '🧑‍🤝‍🧑', label: 'RRHH', kind: 'link', href: '/rrhh', exact: true },
    { emoji: '📅', label: 'Turnos', kind: 'link', href: '/rrhh/turnos' },
    { emoji: '✅', label: 'Tareas', kind: 'link', href: '/tareas' },
  ],
  ADMIN: [
    { emoji: '📊', label: 'Dashboard', kind: 'link', href: '/dashboard' },
    { emoji: '🏢', label: 'Clientes', kind: 'link', href: '/clientes' },
    { emoji: '💵', label: 'Facturas', kind: 'link', href: '/facturas' },
    { emoji: '📣', label: 'Campañas', kind: 'link', href: '/comunicaciones' },
  ],
  SUPER_ADMIN: [
    { emoji: '📊', label: 'Dashboard', kind: 'link', href: '/dashboard' },
    { emoji: '🏢', label: 'Clientes', kind: 'link', href: '/clientes' },
    { emoji: '💵', label: 'Facturas', kind: 'link', href: '/facturas' },
    { emoji: '📣', label: 'Campañas', kind: 'link', href: '/comunicaciones' },
  ],
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

  const actions = QUICK_ACTIONS[role]

  const hoyKey = argentinaDayKey()
  const mesCurrent = hoyKey.slice(0, 7)

  // Mismas queryKeys que attendance-widget.tsx — comparten caché, así que
  // esto no dispara un fetch extra si el header ya las tiene cargadas.
  const { data: hoy } = useQuery({
    queryKey: ['asistencia-hoy', userId],
    queryFn: async () => {
      const r = await fetch(`/api/asistencia?mes=${mesCurrent}&userId=${userId}`)
      if (!r.ok) return null
      const records = ((await r.json()).data ?? []) as AsistenciaHoy[]
      return records.find(rec => rec.fecha.slice(0, 10) === hoyKey) ?? null
    },
    staleTime: 30_000,
    enabled: !!actions?.some(a => a.kind === 'fichar'),
  })
  const { data: turnosHoy } = useQuery({
    queryKey: ['turnos-hoy', userId],
    queryFn: async () => {
      const r = await fetch(`/api/asistencia/turnos?userId=${userId}&mes=${mesCurrent}`)
      if (!r.ok) return []
      const turnos = ((await r.json()).data ?? []) as TurnoHoy[]
      return turnos.filter(t => t.fecha.slice(0, 10) === hoyKey)
    },
    staleTime: 30_000,
    enabled: !!actions?.some(a => a.kind === 'fichar'),
  })
  const openBlock = (turnosHoy ?? []).find(t => !t.horaSalida) ?? null

  // No hay set curado para este rol (no debería pasar con los 5 roles de
  // hoy, pero si mañana se agrega uno nuevo sin actualizar esta lista, la
  // barra simplemente no se renderiza en vez de romper con un array vacío).
  if (!actions) return null

  const handleFichar = async () => {
    if (ficharBusy) return
    setFicharBusy(true)
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
      invalidateFichaje(qc)
    } catch {
      toast.error('Error de conexión')
    } finally {
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
        const content = (
          <>
            <span className="text-[19px] leading-none">
              {a.kind === 'fichar' && ficharBusy ? '⏳' : a.emoji}
            </span>
            <span className="text-[9.5px] font-bold tracking-tight" style={{ color: active ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
              {a.kind === 'fichar' ? (openBlock ? 'Salida' : 'Fichar') : a.label}
            </span>
          </>
        )
        const className = 'flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-all active:scale-90'
        const style = { background: active ? 'rgba(99,102,241,0.1)' : 'transparent' }

        if (a.kind === 'link') {
          return <Link key={a.label} href={a.href} className={className} style={style}>{content}</Link>
        }
        if (a.kind === 'fichar') {
          return <button key={a.label} onClick={handleFichar} disabled={ficharBusy} className={className} style={style}>{content}</button>
        }
        // 'buscar' — abre el mismo buscador del header (useSearchStore),
        // no duplica la búsqueda de empresas en un segundo lugar.
        return <button key={a.label} onClick={() => setSearchOpen(true)} className={className} style={style}>{content}</button>
      })}
      <button onClick={onMore} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-all active:scale-90">
        <span className="text-[16px] leading-none" style={{ color: 'var(--color-text-muted)' }}>⋯</span>
        <span className="text-[9.5px] font-bold tracking-tight" style={{ color: 'var(--color-text-muted)' }}>Más</span>
      </button>
    </nav>
  )
}
