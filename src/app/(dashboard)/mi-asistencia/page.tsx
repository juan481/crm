'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { LogIn, LogOut, Clock, CheckCircle, AlertCircle, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Asistencia } from '@/types'
import toast from 'react-hot-toast'

function formatHora(dt: string | null): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function horasTrabajadas(entrada: string | null, salida: string | null): string {
  if (!entrada || !salida) return '—'
  const ms = new Date(salida).getTime() - new Date(entrada).getTime()
  const h  = Math.floor(ms / 3_600_000)
  const m  = Math.floor((ms % 3_600_000) / 60_000)
  return `${h}h ${m}m`
}

function mesActual() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function MiAsistenciaPage() {
  const qc   = useQueryClient()
  const [now, setNow] = useState(new Date())
  const [checkingIn,  setCheckingIn]  = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const hoy      = now.toISOString().slice(0, 10)
  const horaStr  = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const fechaStr = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const { data: historialData, isLoading } = useQuery({
    queryKey: ['mi-asistencia', mesActual()],
    queryFn:  async () => {
      const r = await fetch(`/api/asistencia?mes=${mesActual()}`)
      if (!r.ok) return []
      return ((await r.json()).data ?? []) as Asistencia[]
    },
    staleTime: 30_000,
  })

  const historial = historialData ?? []
  const hoyRecord = historial.find(r => r.fecha.slice(0, 10) === hoy)

  const hasEntrada = !!hoyRecord?.horaEntrada
  const hasSalida  = !!hoyRecord?.horaSalida
  const esTardanza = hoyRecord?.tardanza
  const esAusente  = hoyRecord?.ausente

  const handleCheckIn = async () => {
    setCheckingIn(true)
    try {
      const res  = await fetch('/api/asistencia/check-in', { method: 'POST' })
      const json = await res.json()
      if (res.status === 409) { toast.error(json.error); qc.invalidateQueries({ queryKey: ['mi-asistencia'] }); return }
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success(json.tardanza ? '⚠️ Entrada registrada con tardanza' : '✅ ¡Buenos días! Entrada registrada')
      qc.invalidateQueries({ queryKey: ['mi-asistencia'] })
    } catch { toast.error('Error de conexión') }
    finally { setCheckingIn(false) }
  }

  const handleCheckOut = async () => {
    setCheckingOut(true)
    try {
      const res  = await fetch('/api/asistencia/check-out', { method: 'POST' })
      const json = await res.json()
      if (res.status === 409) { toast.error(json.error); qc.invalidateQueries({ queryKey: ['mi-asistencia'] }); return }
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success(`Hasta luego! Trabajaste ${json.horasTrabajadas}`)
      qc.invalidateQueries({ queryKey: ['mi-asistencia'] })
    } catch { toast.error('Error de conexión') }
    finally { setCheckingOut(false) }
  }

  // Stats del mes
  const presentes  = historial.filter(r => r.horaEntrada && !r.ausente).length
  const ausentes   = historial.filter(r => r.ausente).length
  const tardanzas  = historial.filter(r => r.tardanza).length
  const totalDias  = presentes + ausentes
  const pctPresent = totalDias > 0 ? Math.round((presentes / totalDias) * 100) : 0

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Mi Asistencia</h1>
        <p className="text-sm capitalize mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{fechaStr}</p>
      </div>

      {/* Check-in card */}
      <div className="rounded-2xl p-6 text-center relative overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        {/* Reloj */}
        <p className="text-5xl font-bold tabular-nums mb-1" style={{ color: 'var(--color-text)' }}>{horaStr}</p>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>{fechaStr}</p>

        {/* Estado hoy */}
        <AnimatePresence mode="wait">
          {esAusente ? (
            <motion.div key="ausente" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 text-sm font-medium"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
              <AlertCircle size={15} /> Marcado como ausente
            </motion.div>
          ) : !hasEntrada ? (
            <motion.div key="noEntrada" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4">
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No registraste entrada hoy</p>
              <Button size="lg" leftIcon={<LogIn size={18} />} onClick={handleCheckIn} loading={checkingIn}
                className="px-8">
                Registrar Entrada
              </Button>
            </motion.div>
          ) : !hasSalida ? (
            <motion.div key="sinSalida" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <span className="flex items-center gap-1.5">
                  <LogIn size={13} /> Entrada: <strong style={{ color: 'var(--color-text)' }}>{formatHora(hoyRecord?.horaEntrada ?? null)}</strong>
                </span>
                {esTardanza && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                    Tardanza
                  </span>
                )}
              </div>
              <Button size="lg" variant="outline" leftIcon={<LogOut size={18} />} onClick={handleCheckOut} loading={checkingOut}
                className="px-8">
                Registrar Salida
              </Button>
            </motion.div>
          ) : (
            <motion.div key="completo" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                <CheckCircle size={24} style={{ color: '#10b981' }} />
              </div>
              <p className="font-semibold" style={{ color: '#10b981' }}>¡Jornada registrada!</p>
              <div className="flex gap-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <span className="flex items-center gap-1.5"><LogIn size={13} /> {formatHora(hoyRecord?.horaEntrada ?? null)}</span>
                <span className="flex items-center gap-1.5"><LogOut size={13} /> {formatHora(hoyRecord?.horaSalida ?? null)}</span>
                <span className="flex items-center gap-1.5">
                  <Clock size={13} /> {horasTrabajadas(hoyRecord?.horaEntrada ?? null, hoyRecord?.horaSalida ?? null)}
                </span>
              </div>
              {esTardanza && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                  Tardanza registrada
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stats mes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Presentes',   value: presentes,  color: '#10b981' },
          { label: 'Ausentes',    value: ausentes,   color: '#ef4444' },
          { label: 'Tardanzas',   value: tardanzas,  color: '#f59e0b' },
          { label: 'Presentismo', value: `${pctPresent}%`, color: 'var(--color-primary)' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 text-center"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Historial */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <Calendar size={16} /> Historial del mes
        </h2>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--color-surface)' }} />
            ))}
          </div>
        ) : historial.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Sin registros este mes</p>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
                  <th className="px-4 py-2.5 text-left font-semibold text-xs" style={{ color: 'var(--color-text-muted)' }}>Fecha</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-xs" style={{ color: 'var(--color-text-muted)' }}>Entrada</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-xs" style={{ color: 'var(--color-text-muted)' }}>Salida</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-xs hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>Horas</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-xs" style={{ color: 'var(--color-text-muted)' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {[...historial].sort((a, b) => b.fecha.localeCompare(a.fecha)).map(r => {
                  const isHoy = r.fecha.slice(0, 10) === hoy
                  return (
                    <tr key={r.id}
                      className={`transition-colors hover:bg-[var(--color-surface-raised)] ${isHoy ? 'bg-[var(--color-primary)]/5' : ''}`}
                      style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>
                        {new Date(r.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                        {isHoy && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-primary)', color: '#fff' }}>Hoy</span>}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-text-muted)' }}>{formatHora(r.horaEntrada)}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-text-muted)' }}>{formatHora(r.horaSalida)}</td>
                      <td className="px-4 py-3 hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>
                        {horasTrabajadas(r.horaEntrada, r.horaSalida)}
                      </td>
                      <td className="px-4 py-3">
                        {r.ausente ? (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>Ausente</span>
                        ) : r.tardanza ? (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>Tardanza</span>
                        ) : r.horaEntrada ? (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>Presente</span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>—</span>
                        )}
                        {r.observaciones && (
                          <span className="ml-1.5 text-[10px]" style={{ color: 'var(--color-text-subtle)' }} title={r.observaciones}>📝</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
