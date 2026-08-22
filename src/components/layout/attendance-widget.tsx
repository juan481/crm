'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, LogIn, LogOut, CheckCircle2, Plus, Home, Briefcase } from 'lucide-react'
import toast from 'react-hot-toast'
import { argentinaDayKey } from '@/lib/timezone'
import { MODALIDADES_FICHAJE } from '@/lib/asistencia-turnos'
import { invalidateFichaje } from '@/lib/asistencia-query-keys'
import { getPositionSafe } from '@/lib/geolocation'

interface AsistenciaHoy {
  fecha: string
  horaEntrada: string | null
  horaSalida: string | null
  tardanza: boolean
}
interface TurnoHoy {
  id: string
  fecha: string
  horaEntrada: string | null
  horaSalida: string | null
  esPrincipal: boolean
}

// Widget de fichaje visible en el header, para CUALQUIER rol en CUALQUIER
// pantalla — antes sólo Técnico (vía Mi Día) tenía el fichaje a un clic;
// el resto tenía que navegar a Mi Asistencia a propósito. Usa la MISMA
// queryKey que ya usa Mi Día (['asistencia-hoy', userId]) para compartir
// caché y quedar siempre sincronizados entre sí, en vez de dos fuentes de
// verdad independientes que podrían mostrarse desincronizadas.
export function AttendanceWidget({ userId }: { userId: string }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [nudgeVisible, setNudgeVisible] = useState(false)
  const [autoNudgeFired, setAutoNudgeFired] = useState(false)
  const [modalidad, setModalidad] = useState(MODALIDADES_FICHAJE[0])
  const ref = useRef<HTMLDivElement>(null)

  // argentinaDayKey, no toISOString (siempre UTC) — a la noche (hora
  // Argentina) toISOString ya cae en el día siguiente y este "hoy" dejaba
  // de encontrar el fichaje recién hecho. Ver src/lib/timezone.ts.
  const mesCurrent = argentinaDayKey().slice(0, 7)
  const hoyKey = argentinaDayKey()

  const { data: hoy, refetch } = useQuery({
    queryKey: ['asistencia-hoy', userId],
    queryFn: async () => {
      // &userId= explícito — SIN esto, para SUPER_ADMIN/ADMIN/HR (que
      // pueden ver la asistencia de toda la org, ver /api/asistencia
      // route.ts) esta consulta devolvía los registros de TODO el equipo, y
      // el .find() de abajo agarraba el primero que matcheara la fecha de
      // hoy — el de OTRA persona, no el propio. Por eso un SUPER_ADMIN veía
      // "En jornada, fichar salida" en este widget (registro ajeno) mientras
      // Mi Asistencia (que sí manda userId) mostraba correctamente "todavía
      // no fichaste". Mismo criterio que ya usaba mi-asistencia/page.tsx.
      const r = await fetch(`/api/asistencia?mes=${mesCurrent}&userId=${userId}`)
      if (!r.ok) return null
      const records = ((await r.json()).data ?? []) as AsistenciaHoy[]
      return records.find(rec => rec.fecha.slice(0, 10) === hoyKey) ?? null
    },
    staleTime: 30_000,
  })

  // Bloques (regular + extras) de hoy — necesario para saber si hay un
  // bloque ABIERTO ahora mismo (sea el principal o un extra) y para poder
  // ofrecer "+ Turno adicional" una vez que el principal ya cerró. Sin
  // esto, `hoy` (el mirror en Asistencia) sólo sabe del bloque principal —
  // sería imposible fichar/cerrar un segundo bloque desde acá.
  const { data: turnosHoy, refetch: refetchTurnos } = useQuery({
    queryKey: ['turnos-hoy', userId],
    queryFn: async () => {
      const r = await fetch(`/api/asistencia/turnos?userId=${userId}&mes=${mesCurrent}`)
      if (!r.ok) return []
      const turnos = ((await r.json()).data ?? []) as TurnoHoy[]
      return turnos.filter(t => t.fecha.slice(0, 10) === hoyKey)
    },
    staleTime: 30_000,
  })
  const openBlock = (turnosHoy ?? []).find(t => !t.horaSalida) ?? null

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Globito recordatorio ("¿Ya fichaste hoy?") — se muestra UNA sola vez por
  // carga de página (autoNudgeFired evita que se repita en loop cada vez que
  // el timeout lo esconde), sólo si todavía no fichó entrada. `hoy !==
  // undefined` espera a que la consulta resuelva de verdad (evita mostrarlo
  // de arranque mientras carga).
  useEffect(() => {
    if (hoy !== undefined && !hoy?.horaEntrada && !autoNudgeFired) {
      setNudgeVisible(true)
      setAutoNudgeFired(true)
      const t = setTimeout(() => setNudgeVisible(false), 5000)
      return () => clearTimeout(t)
    }
  }, [hoy, autoNudgeFired])

  const refreshEverywhere = () => {
    // invalidateFichaje cubre las 5 queryKeys relacionadas (este widget,
    // Mi Día, Mi Asistencia, RRHH y el panel de Turnos) — antes esto sólo
    // invalidaba un subconjunto a mano, y alguna pantalla podía quedar
    // desincronizada hasta que venciera su staleTime.
    invalidateFichaje(qc)
    refetch()
    refetchTurnos()
  }

  const handleCheckIn = async () => {
    setBusy(true)
    try {
      const pos = await getPositionSafe()
      const res = await fetch('/api/asistencia/check-in', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modalidad, lat: pos?.lat, lng: pos?.lng }),
      })
      const json = await res.json()
      if (res.status === 409) { toast.error(json.error); refreshEverywhere(); return }
      if (!res.ok) { toast.error(json.error ?? 'Error al fichar entrada'); return }
      toast.success(json.tardanza ? '⚠️ Entrada registrada con tardanza' : json.esPrincipal ? '✅ Entrada registrada' : '✅ Turno adicional registrado')
      refreshEverywhere()
    } catch { toast.error('Error de conexión') }
    finally { setBusy(false) }
  }

  const handleCheckOut = async () => {
    setBusy(true)
    try {
      const pos = await getPositionSafe()
      const res = await fetch('/api/asistencia/check-out', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: pos?.lat, lng: pos?.lng }),
      })
      const json = await res.json()
      // check-out/route.ts nunca devuelve 409 (sólo 400 "no hay entrada
      // abierta") — el chequeo de 409 de acá era código muerto copiado del
      // check-in real, que sí lo usa. !res.ok ya cubre el único caso de
      // error que esta ruta puede devolver.
      if (!res.ok) { toast.error(json.error ?? 'Error al fichar salida'); return }
      toast.success(`Hasta luego — trabajaste ${json.horasTrabajadas}`)
      refreshEverywhere()
    } catch { toast.error('Error de conexión') }
    finally { setBusy(false) }
  }

  const formatHora = (dt: string | null) => dt ? new Date(dt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—'

  // Bug real encontrado en auditoría: mientras las 2 queries (`hoy` y
  // `turnosHoy`) todavía no resolvieron su primer fetch (recién logueado,
  // hard-reload), `hoy` es `undefined` y `!hoy?.horaEntrada` da `true` —
  // el estado caía siempre a "none" y mostraba "Fichar entrada" aunque la
  // persona ya tuviera la jornada en curso o completa. Se corrige solo
  // apenas llegan los datos, pero mientras tanto mostraba el CTA
  // equivocado. Ahora hay un estado 'loading' explícito.
  const stillLoading = hoy === undefined || turnosHoy === undefined

  // `openBlock` manda por sobre el mirror de Asistencia: si hay CUALQUIER
  // bloque abierto (principal o extra), el botón tiene que ser "salida" —
  // antes esto sólo miraba `hoy` (el principal), así que una vez que ese
  // cerraba, no había forma de fichar/cerrar un segundo bloque desde acá.
  const state: 'loading' | 'none' | 'in' | 'done' =
    stillLoading ? 'loading' : openBlock ? 'in' : !hoy?.horaEntrada ? 'none' : 'done'
  const pillStyle =
    state === 'done' ? { background: 'rgba(16,185,129,0.12)', color: '#059669' } :
    state === 'in'   ? { background: 'rgba(99,102,241,0.12)', color: 'var(--color-primary)' } :
                        { background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }
  const pillLabel =
    state === 'loading' ? '···' :
    state === 'done' ? `Completo · ${formatHora(hoy?.horaEntrada ?? null)}-${formatHora(hoy?.horaSalida ?? null)}` :
    state === 'in'   ? `En jornada · ${formatHora(openBlock?.horaEntrada ?? hoy?.horaEntrada ?? null)}` :
                        'Fichar'

  // Globito ("¿Ya fichaste hoy?") sólo tiene sentido si todavía no fichó —
  // una vez que fichó, no hay nada que recordarle. Nunca mientras carga.
  const showBubble = state === 'none' && (nudgeVisible || hovering) && !open

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <button
        onClick={() => { setOpen(v => !v); setNudgeVisible(false) }}
        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-80"
        style={pillStyle}
        title="Fichaje del día"
      >
        {state === 'done' ? <CheckCircle2 size={13} /> : <Clock size={13} />}
        {pillLabel}
      </button>
      {/* Versión mínima para mobile — sólo el ícono, mismo popover */}
      <button
        onClick={() => { setOpen(v => !v); setNudgeVisible(false) }}
        className="sm:hidden p-2 rounded-xl transition-all hover:bg-[var(--color-surface-raised)]"
        style={{ color: state === 'in' ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
        title="Fichaje del día"
      >
        <Clock size={16} />
      </button>

      {/* Globito recordatorio — se posiciona con right-0 (no left) igual que
          el popover de abajo, así nunca se sale de la pantalla por el lado
          derecho en mobile; con max-w limitado tampoco se corta por el
          izquierdo en una pantalla angosta. */}
      {showBubble && (
        <div
          className="absolute right-0 top-full mt-2 z-50 px-3 py-2 rounded-xl text-xs font-medium text-white whitespace-nowrap max-w-[85vw]"
          style={{ background: '#1e293b', boxShadow: '0 10px 25px rgba(0,0,0,0.25)' }}
        >
          <div className="absolute -top-1 right-3 w-2 h-2 rotate-45" style={{ background: '#1e293b' }} />
          ¿Ya fichaste hoy? 👋
        </div>
      )}

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-72 rounded-2xl overflow-hidden z-50 p-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}
        >
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>Asistencia de hoy</p>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
            {state === 'loading' && 'Cargando...'}
            {state === 'none' && 'Todavía no fichaste tu entrada.'}
            {state === 'in' && `Entrada ${formatHora(openBlock?.horaEntrada ?? hoy?.horaEntrada ?? null)}${openBlock?.esPrincipal && hoy?.tardanza ? ' (con tardanza)' : ''} — jornada en curso${openBlock && !openBlock.esPrincipal ? ' (turno adicional)' : ''}.`}
            {state === 'done' && `Entrada ${formatHora(hoy?.horaEntrada ?? null)} · Salida ${formatHora(hoy?.horaSalida ?? null)}.`}
          </p>

          {state === 'none' && (
            <>
              <div className="flex gap-1.5 mb-2">
                {MODALIDADES_FICHAJE.map(m => (
                  <button key={m} onClick={() => setModalidad(m)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                    style={modalidad === m
                      ? { background: 'var(--color-primary)', color: '#fff' }
                      : { background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                    {m === 'Presencial' ? <Home size={11} /> : <Briefcase size={11} />}{m}
                  </button>
                ))}
              </div>
              <button
                onClick={handleCheckIn}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 gradient-bg"
              >
                <LogIn size={14} />
                {busy ? 'Guardando...' : 'Fichar entrada'}
              </button>
            </>
          )}

          {state === 'in' && (
            <button
              onClick={handleCheckOut}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 gradient-bg"
            >
              <LogOut size={14} />
              {busy ? 'Guardando...' : 'Fichar salida'}
            </button>
          )}

          {state === 'done' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs" style={{ color: '#059669' }}>
                <CheckCircle2 size={14} /> Jornada completa
              </div>
              {/* Turno adicional/extra el mismo día — antes esto era
                  imposible (el check-in tiraba 409 apenas había una entrada
                  de hoy, sea cual sea el estado de su salida). El server ya
                  sabe que esto es un extra (ver check-in/route.ts). */}
              <button
                onClick={handleCheckIn}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
                style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text)' }}
              >
                <Plus size={13} /> Turno adicional
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
