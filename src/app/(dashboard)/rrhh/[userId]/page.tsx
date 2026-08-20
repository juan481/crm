'use client'

import { useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, CheckCircle, AlertCircle, Clock, AlertTriangle, Pencil, Calendar, LogIn, LogOut, ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Avatar } from '@/components/ui/avatar'
import { useThemeStore } from '@/store/theme-store'
import { getRoleLabel } from '@/lib/role-labels'
import { timeAgo } from '@/lib/utils'
import type { Asistencia } from '@/types'

interface LoginEventRow {
  id: string
  type: 'LOGIN' | 'LOGOUT'
  ipAddress: string | null
  createdAt: string
}
import toast from 'react-hot-toast'

function formatHora(dt: string | null): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function horasTrabajadas(entrada: string | null, salida: string | null): string {
  if (!entrada || !salida) return '—'
  const ms = new Date(salida).getTime() - new Date(entrada).getTime()
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`
}

function mesActual() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Mismo helper que rrhh/page.tsx — días hábiles (lun-vie) transcurridos en
// `mes` hasta hoy (o el mes entero si ya terminó). Denominador real del %
// de presentismo, ver Fase 12 del plan.
function weekdaysElapsed(mes: string): number {
  const [y, m] = mes.split('-').map(Number)
  const monthStart = new Date(y, m - 1, 1)
  const monthEnd   = new Date(y, m, 0)
  const today      = new Date()
  const end        = today < monthEnd ? today : monthEnd
  let count = 0
  for (const d = new Date(monthStart); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
  }
  return count
}

export default function EmpleadoRrhhPage() {
  const { userId } = useParams<{ userId: string }>()
  const router     = useRouter()
  const searchParams = useSearchParams()
  const qc         = useQueryClient()
  const { vertical } = useThemeStore()
  const [mes, setMes] = useState(searchParams.get('mes') ?? mesActual())

  const [editRecord, setEditRecord] = useState<Asistencia | null>(null)
  const [editForm,   setEditForm]   = useState({ ausente: false, tardanza: false, observaciones: '', horaEntrada: '', horaSalida: '' })
  const [saving,     setSaving]     = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['asistencia-empleado', userId, mes],
    queryFn:  async () => {
      const r = await fetch(`/api/asistencia?userId=${userId}&mes=${mes}`)
      if (!r.ok) return []
      return ((await r.json()).data ?? []) as Asistencia[]
    },
    staleTime: 30_000,
  })

  // Log real de accesos (login/logout) — independiente del fichaje, no se
  // puede falsear porque se escribe server-side en el momento exacto del
  // login/logout (ver /api/auth/log-login y /api/auth/logout). Pedido
  // explícito: "el dueño quiere saber cuándo entra y sale cada usuario, por
  // si le dicen 'no fiché'".
  const { data: loginEventsData } = useQuery({
    queryKey: ['login-events', userId],
    queryFn:  async () => {
      const r = await fetch(`/api/login-events?userId=${userId}&limit=30`)
      if (!r.ok) return []
      return ((await r.json()).data ?? []) as LoginEventRow[]
    },
    staleTime: 30_000,
  })
  const loginEvents = loginEventsData ?? []

  const records  = (data ?? []).sort((a, b) => b.fecha.localeCompare(a.fecha))
  const empleado = records[0]?.user

  const presentes = records.filter(r => r.horaEntrada && !r.ausente).length
  const ausentes  = records.filter(r => r.ausente).length
  const tardanzas = records.filter(r => r.tardanza).length
  const totalWeekdays = weekdaysElapsed(mes)
  const sinFichar = Math.max(0, totalWeekdays - (presentes + ausentes))
  const pct       = totalWeekdays > 0 ? Math.round((presentes / totalWeekdays) * 100) : 0

  const openEdit = (r: Asistencia) => {
    setEditRecord(r)
    setEditForm({
      ausente:       r.ausente,
      tardanza:      r.tardanza,
      observaciones: r.observaciones ?? '',
      horaEntrada:   r.horaEntrada ? new Date(r.horaEntrada).toTimeString().slice(0, 5) : '',
      horaSalida:    r.horaSalida  ? new Date(r.horaSalida).toTimeString().slice(0, 5)  : '',
    })
  }

  const handleSaveEdit = async () => {
    if (!editRecord) return
    setSaving(true)
    try {
      const fecha = editRecord.fecha.slice(0, 10)
      const toIso = (t: string) => {
        if (!t) return null
        const [y, mo, d] = fecha.split('-').map(Number)
        const [h, m]     = t.split(':').map(Number)
        return new Date(y, mo - 1, d, h, m, 0).toISOString()
      }
      const res  = await fetch(`/api/asistencia/${editRecord.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ausente:       editForm.ausente,
          tardanza:      editForm.tardanza,
          observaciones: editForm.observaciones || null,
          horaEntrada:   toIso(editForm.horaEntrada),
          horaSalida:    toIso(editForm.horaSalida),
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success('Registro actualizado')
      qc.invalidateQueries({ queryKey: ['asistencia-empleado', userId, mes] })
      qc.invalidateQueries({ queryKey: ['asistencia-rrhh', mes] })
      setEditRecord(null)
    } catch { toast.error('Error de conexión') }
    finally { setSaving(false) }
  }

  const [mesYear, mesMes] = mes.split('-')
  const mesLabel = new Date(Number(mesYear), Number(mesMes) - 1, 1)
    .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  // Build calendar grid for the month
  const daysInMonth = new Date(Number(mesYear), Number(mesMes), 0).getDate()
  const firstDow    = new Date(Number(mesYear), Number(mesMes) - 1, 1).getDay() // 0=Sun
  const calDays: Array<{ date: string; record: Asistencia | undefined; isWeekend: boolean }> = []
  for (let d = 1; d <= daysInMonth; d++) {
    const dt  = new Date(Number(mesYear), Number(mesMes) - 1, d)
    const iso = `${mesYear}-${mesMes}-${String(d).padStart(2, '0')}`
    calDays.push({
      date:      iso,
      record:    records.find(r => r.fecha.slice(0, 10) === iso),
      isWeekend: dt.getDay() === 0 || dt.getDay() === 6,
    })
  }

  const cellColor = (day: typeof calDays[0]) => {
    if (!day.record && day.isWeekend) return { bg: 'var(--color-surface-raised)', text: 'var(--color-text-subtle)', border: 'var(--color-border)' }
    if (!day.record) return { bg: 'var(--color-surface)', text: 'var(--color-text-subtle)', border: 'var(--color-border)' }
    if (day.record.ausente) return { bg: 'rgba(239,68,68,0.1)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' }
    if (day.record.tardanza) return { bg: 'rgba(245,158,11,0.1)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)' }
    if (day.record.horaEntrada) return { bg: 'rgba(16,185,129,0.1)', text: '#10b981', border: 'rgba(16,185,129,0.3)' }
    return { bg: 'var(--color-surface)', text: 'var(--color-text-subtle)', border: 'var(--color-border)' }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap justify-between">
        <button onClick={() => router.push(`/rrhh`)}
          className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
          style={{ color: 'var(--color-text-muted)' }}>
          <ArrowLeft size={15} /> RRHH
        </button>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
      </div>

      {/* Employee card */}
      {empleado && (
        <div className="flex items-center gap-4 p-4 rounded-2xl"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <Avatar name={empleado.name} src={empleado.avatarUrl} size="lg" />
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{empleado.name}</h1>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{getRoleLabel(empleado.role, vertical)} — {mesLabel}</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Presentes',   value: presentes,  color: '#10b981' },
          { label: 'Ausentes',    value: ausentes,   color: '#ef4444' },
          { label: 'Tardanzas',   value: tardanzas,  color: '#f59e0b' },
          { label: 'Sin fichar',  value: sinFichar,  color: 'var(--color-text-subtle)' },
          { label: 'Presentismo', value: `${pct}%`,  color: 'var(--color-primary)' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 text-center"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          <AlertTriangle size={16} />
          Error al cargar los datos. Intentá de nuevo.
        </div>
      )}

      {/* Calendar */}
      <div className="rounded-2xl overflow-hidden p-4"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <Calendar size={15} /> Calendario — {mesLabel}
        </h2>
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
            <div key={d} className="text-center text-[10px] font-semibold py-1" style={{ color: 'var(--color-text-subtle)' }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for first week */}
          {Array.from({ length: firstDow }).map((_, i) => <div key={`e-${i}`} />)}
          {calDays.map(day => {
            const c = cellColor(day)
            return (
              <button key={day.date} onClick={() => day.record && openEdit(day.record)}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all hover:opacity-80 ${day.record ? 'cursor-pointer' : 'cursor-default'}`}
                style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                <span className="font-medium">{Number(day.date.slice(8))}</span>
                {day.record?.tardanza && !day.record?.ausente && <AlertTriangle size={8} className="mt-0.5" />}
                {day.record?.ausente && <AlertCircle size={8} className="mt-0.5" />}
                {day.record?.horaEntrada && !day.record?.ausente && <CheckCircle size={8} className="mt-0.5" />}
              </button>
            )
          })}
        </div>
        <div className="flex gap-4 mt-3 flex-wrap">
          {[
            { color: 'rgba(16,185,129,0.3)', label: 'Presente', text: '#10b981' },
            { color: 'rgba(245,158,11,0.3)', label: 'Tardanza', text: '#f59e0b' },
            { color: 'rgba(239,68,68,0.3)',  label: 'Ausente',  text: '#ef4444' },
          ].map(l => (
            <span key={l.label} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <span className="w-3 h-3 rounded" style={{ background: l.color, border: `1px solid ${l.color}` }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--color-surface)' }} />)}
        </div>
      ) : records.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
                {['Fecha', 'Entrada', 'Salida', 'Horas', 'Estado', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id} className="hover:bg-[var(--color-surface-raised)] transition-colors"
                  style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>
                    {new Date(r.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-muted)' }}>{formatHora(r.horaEntrada)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-muted)' }}>{formatHora(r.horaSalida)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-muted)' }}>{horasTrabajadas(r.horaEntrada, r.horaSalida)}</td>
                  <td className="px-4 py-3">
                    {r.ausente ? (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>Ausente</span>
                    ) : r.tardanza ? (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>Tardanza</span>
                    ) : r.horaEntrada ? (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>Presente</span>
                    ) : <span style={{ color: 'var(--color-text-subtle)' }}>—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(r)}
                      className="p-1.5 rounded-lg hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] transition-colors"
                      style={{ color: 'var(--color-text-muted)' }}>
                      <Pencil size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Accesos reales — log objetivo de login/logout, distinto del
          fichaje (que el empleado puede simplemente no tocar). */}
      <div className="rounded-2xl overflow-hidden p-4"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h2 className="text-sm font-semibold mb-1 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <ShieldCheck size={15} /> Accesos reales al sistema
        </h2>
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-subtle)' }}>
          Cuándo entró y salió de verdad del CRM (no depende de que haya fichado).
        </p>
        {loginEvents.length === 0 ? (
          <p className="text-sm py-2" style={{ color: 'var(--color-text-subtle)' }}>Todavía no hay accesos registrados.</p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {loginEvents.map(ev => (
              <div key={ev.id} className="flex items-center gap-2.5 text-sm py-1">
                {ev.type === 'LOGIN'
                  ? <LogIn size={13} style={{ color: '#10b981' }} />
                  : <LogOut size={13} style={{ color: 'var(--color-text-subtle)' }} />}
                <span style={{ color: 'var(--color-text)' }}>{ev.type === 'LOGIN' ? 'Entró' : 'Salió'}</span>
                <span style={{ color: 'var(--color-text-subtle)' }}>
                  {new Date(ev.createdAt).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {' · '}{timeAgo(ev.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      <Modal open={!!editRecord} onClose={() => setEditRecord(null)} title="Editar registro" size="sm">
        {editRecord && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {new Date(editRecord.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Hora entrada" type="time" value={editForm.horaEntrada}
                onChange={e => setEditForm(f => ({ ...f, horaEntrada: e.target.value }))} />
              <Input label="Hora salida" type="time" value={editForm.horaSalida}
                onChange={e => setEditForm(f => ({ ...f, horaSalida: e.target.value }))} />
            </div>
            <div className="flex gap-4">
              {[{ key: 'ausente', label: 'Ausente' }, { key: 'tardanza', label: 'Tardanza' }].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-text)' }}>
                  <input type="checkbox" checked={(editForm as any)[key]}
                    onChange={e => setEditForm(f => ({ ...f, [key]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Observaciones</label>
              <textarea rows={2} value={editForm.observaciones}
                onChange={e => setEditForm(f => ({ ...f, observaciones: e.target.value }))}
                placeholder="Notas adicionales..."
                className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 transition-all"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
            </div>
            <ModalFooter>
              <Button variant="ghost" onClick={() => setEditRecord(null)}>Cancelar</Button>
              <Button onClick={handleSaveEdit} loading={saving}>Guardar</Button>
            </ModalFooter>
          </div>
        )}
      </Modal>
    </div>
  )
}
