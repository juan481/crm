'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, LogIn, LogOut, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface AsistenciaHoy {
  fecha: string
  horaEntrada: string | null
  horaSalida: string | null
  tardanza: boolean
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
  const ref = useRef<HTMLDivElement>(null)

  const mesCurrent = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const hoyKey = new Date().toISOString().slice(0, 10)

  const { data: hoy, refetch } = useQuery({
    queryKey: ['asistencia-hoy', userId],
    queryFn: async () => {
      const r = await fetch(`/api/asistencia?mes=${mesCurrent}`)
      if (!r.ok) return null
      const records = ((await r.json()).data ?? []) as AsistenciaHoy[]
      return records.find(rec => rec.fecha.slice(0, 10) === hoyKey) ?? null
    },
    staleTime: 30_000,
  })

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const refreshEverywhere = () => {
    // Invalida por prefijo — cubre este widget, Mi Día y Mi Asistencia
    // (cada uno con su propia queryKey) aunque estén montados en simultáneo.
    qc.invalidateQueries({ queryKey: ['asistencia-hoy'] })
    qc.invalidateQueries({ queryKey: ['mi-asistencia'] })
    qc.invalidateQueries({ queryKey: ['asistencia-rrhh'] })
    refetch()
  }

  const handleCheckIn = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/asistencia/check-in', { method: 'POST' })
      const json = await res.json()
      if (res.status === 409) { toast.error(json.error); refreshEverywhere(); return }
      if (!res.ok) { toast.error(json.error ?? 'Error al fichar entrada'); return }
      toast.success(json.tardanza ? '⚠️ Entrada registrada con tardanza' : '✅ Entrada registrada')
      refreshEverywhere()
    } catch { toast.error('Error de conexión') }
    finally { setBusy(false) }
  }

  const handleCheckOut = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/asistencia/check-out', { method: 'POST' })
      const json = await res.json()
      if (res.status === 409) { toast.error(json.error); refreshEverywhere(); return }
      if (!res.ok) { toast.error(json.error ?? 'Error al fichar salida'); return }
      toast.success(`Hasta luego — trabajaste ${json.horasTrabajadas}`)
      refreshEverywhere()
    } catch { toast.error('Error de conexión') }
    finally { setBusy(false) }
  }

  const formatHora = (dt: string | null) => dt ? new Date(dt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—'

  const state: 'none' | 'in' | 'done' = !hoy?.horaEntrada ? 'none' : hoy.horaSalida ? 'done' : 'in'
  const pillStyle =
    state === 'done' ? { background: 'rgba(16,185,129,0.12)', color: '#059669' } :
    state === 'in'   ? { background: 'rgba(99,102,241,0.12)', color: 'var(--color-primary)' } :
                        { background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }
  const pillLabel =
    state === 'done' ? `Completo · ${formatHora(hoy?.horaEntrada ?? null)}-${formatHora(hoy?.horaSalida ?? null)}` :
    state === 'in'   ? `En jornada · ${formatHora(hoy?.horaEntrada ?? null)}` :
                        'Fichar'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-80"
        style={pillStyle}
        title="Fichaje del día"
      >
        {state === 'done' ? <CheckCircle2 size={13} /> : <Clock size={13} />}
        {pillLabel}
      </button>
      {/* Versión mínima para mobile — sólo el ícono, mismo popover */}
      <button
        onClick={() => setOpen(v => !v)}
        className="sm:hidden p-2 rounded-xl transition-all hover:bg-[var(--color-surface-raised)]"
        style={{ color: state === 'in' ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
        title="Fichaje del día"
      >
        <Clock size={16} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-64 rounded-2xl overflow-hidden z-50 p-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}
        >
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>Asistencia de hoy</p>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
            {state === 'none' && 'Todavía no fichaste tu entrada.'}
            {state === 'in' && `Entrada ${formatHora(hoy?.horaEntrada ?? null)}${hoy?.tardanza ? ' (con tardanza)' : ''} — jornada en curso.`}
            {state === 'done' && `Entrada ${formatHora(hoy?.horaEntrada ?? null)} · Salida ${formatHora(hoy?.horaSalida ?? null)}.`}
          </p>
          {state !== 'done' && (
            <button
              onClick={state === 'none' ? handleCheckIn : handleCheckOut}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 gradient-bg"
            >
              {state === 'none' ? <LogIn size={14} /> : <LogOut size={14} />}
              {busy ? 'Guardando...' : state === 'none' ? 'Fichar entrada' : 'Fichar salida'}
            </button>
          )}
          {state === 'done' && (
            <div className="flex items-center gap-2 text-xs" style={{ color: '#059669' }}>
              <CheckCircle2 size={14} /> Jornada completa
            </div>
          )}
        </div>
      )}
    </div>
  )
}
