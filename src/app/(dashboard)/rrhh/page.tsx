'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  ClipboardList, ChevronRight, CheckCircle, AlertCircle, Clock, Search,
  AlertTriangle, X, Pencil, Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Avatar } from '@/components/ui/avatar'
import type { Asistencia } from '@/types'
import toast from 'react-hot-toast'

function mesActual() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatHora(dt: string | null): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function horasTrabajadas(entrada: string | null, salida: string | null): string {
  if (!entrada || !salida) return '—'
  const ms = new Date(salida).getTime() - new Date(entrada).getTime()
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`
}

interface EmpleadoRow {
  userId:    string
  name:      string
  role:      string
  avatarUrl: string | null
  presentes: number
  ausentes:  number
  tardanzas: number
  pct:       number
  records:   Asistencia[]
}

export default function RrhhPage() {
  const router = useRouter()
  const qc     = useQueryClient()
  const [mes,    setMes]    = useState(mesActual())
  const [search, setSearch] = useState('')

  // Edit modal
  const [editRecord,  setEditRecord]  = useState<Asistencia | null>(null)
  const [editForm,    setEditForm]    = useState({ ausente: false, tardanza: false, observaciones: '', horaEntrada: '', horaSalida: '' })
  const [saving,      setSaving]      = useState(false)

  // Mark absent modal
  const [absenteModal, setAbsenteModal] = useState<{ userId: string; name: string } | null>(null)
  const [absenteDate,  setAbsenteDate]  = useState(new Date().toISOString().slice(0, 10))
  const [markingAbs,   setMarkingAbs]   = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['asistencia-rrhh', mes],
    queryFn:  async () => {
      const r = await fetch(`/api/asistencia?mes=${mes}`)
      if (!r.ok) return []
      return ((await r.json()).data ?? []) as Asistencia[]
    },
    staleTime: 30_000,
  })

  const records = data ?? []

  // Group by user
  const byUser = records.reduce<Record<string, EmpleadoRow>>((acc, r) => {
    const uid  = r.userId
    const user = r.user!
    if (!acc[uid]) acc[uid] = { userId: uid, name: user.name, role: user.role, avatarUrl: user.avatarUrl, presentes: 0, ausentes: 0, tardanzas: 0, pct: 0, records: [] }
    acc[uid].records.push(r)
    if (r.ausente)       acc[uid].ausentes++
    else if (r.horaEntrada) acc[uid].presentes++
    if (r.tardanza)      acc[uid].tardanzas++
    return acc
  }, {})

  const empleados: EmpleadoRow[] = Object.values(byUser).map(e => ({
    ...e,
    pct: (e.presentes + e.ausentes) > 0 ? Math.round((e.presentes / (e.presentes + e.ausentes)) * 100) : 0,
  })).sort((a, b) => a.name.localeCompare(b.name))

  const filtered = empleados.filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()))

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
      const toIso = (timeStr: string) => timeStr ? `${fecha}T${timeStr}:00.000Z` : null

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
      qc.invalidateQueries({ queryKey: ['asistencia-rrhh', mes] })
      setEditRecord(null)
    } catch { toast.error('Error de conexión') }
    finally { setSaving(false) }
  }

  const handleMarkAbsent = async () => {
    if (!absenteModal) return
    setMarkingAbs(true)
    try {
      const res = await fetch('/api/asistencia/check-in', { method: 'POST' })
      // We need a different approach: create/update the record directly
      // Use the PATCH endpoint via a workaround — create first, then patch
      // Actually we need to create an Asistencia record via a different endpoint
      // For now, use the existing [id] PATCH but we need the record id first
      // Let's use a dedicated approach: POST to /api/asistencia with userId
      const r = await fetch('/api/asistencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: absenteModal.userId, fecha: absenteDate, ausente: true }),
      })
      if (!r.ok) { const j = await r.json(); toast.error(j.error ?? 'Error'); return }
      toast.success(`${absenteModal.name} marcado como ausente`)
      qc.invalidateQueries({ queryKey: ['asistencia-rrhh', mes] })
      setAbsenteModal(null)
    } catch { toast.error('Error de conexión') }
    finally { setMarkingAbs(false) }
  }

  // Mes display
  const [mesYear, mesMes] = mes.split('-')
  const mesLabel = new Date(Number(mesYear), Number(mesMes) - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
            <ClipboardList size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>RRHH</h1>
            <p className="text-sm capitalize" style={{ color: 'var(--color-text-muted)' }}>Asistencia y presentismo — {mesLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={mes} onChange={e => setMes(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-subtle)' }} />
        <input type="text" placeholder="Buscar empleado..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'var(--color-surface)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <ClipboardList size={36} className="mx-auto mb-3" style={{ color: 'var(--color-text-subtle)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
            {search ? `Sin resultados para "${search}"` : 'Sin registros de asistencia este mes'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(e => (
            <motion.div key={e.userId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              {/* Employee header row */}
              <div className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-[var(--color-surface-raised)] transition-colors"
                onClick={() => router.push(`/rrhh/${e.userId}?mes=${mes}`)}>
                <Avatar name={e.name} src={e.avatarUrl} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{e.name}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{e.role}</p>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-center hidden sm:block">
                    <p className="text-lg font-bold" style={{ color: '#10b981' }}>{e.presentes}</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-subtle)' }}>Presentes</p>
                  </div>
                  <div className="text-center hidden sm:block">
                    <p className="text-lg font-bold" style={{ color: '#ef4444' }}>{e.ausentes}</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-subtle)' }}>Ausentes</p>
                  </div>
                  <div className="text-center hidden md:block">
                    <p className="text-lg font-bold" style={{ color: '#f59e0b' }}>{e.tardanzas}</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-subtle)' }}>Tardanzas</p>
                  </div>
                  {/* Presentismo bar */}
                  <div className="text-center min-w-[60px]">
                    <p className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{e.pct}%</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-subtle)' }}>Presentismo</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={ev => { ev.stopPropagation(); setAbsenteModal({ userId: e.userId, name: e.name }) }}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      style={{ color: 'var(--color-text-muted)' }} title="Marcar ausencia">
                      <AlertTriangle size={14} />
                    </button>
                    <ChevronRight size={16} style={{ color: 'var(--color-text-subtle)' }} />
                  </div>
                </div>
              </div>

              {/* Last 5 records mini table */}
              {e.records.slice(0, 3).map(r => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-2 border-t text-xs"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}>
                  <span className="w-20 shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(r.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                  </span>
                  {r.ausente ? (
                    <span className="flex items-center gap-1" style={{ color: '#ef4444' }}><AlertCircle size={11} /> Ausente</span>
                  ) : r.horaEntrada ? (
                    <span className="flex items-center gap-1" style={{ color: '#10b981' }}>
                      <CheckCircle size={11} /> {formatHora(r.horaEntrada)} → {formatHora(r.horaSalida)}
                      {r.tardanza && <span className="ml-2" style={{ color: '#f59e0b' }}>Tardanza</span>}
                      <span className="ml-2" style={{ color: 'var(--color-text-subtle)' }}>{horasTrabajadas(r.horaEntrada, r.horaSalida)}</span>
                    </span>
                  ) : <span style={{ color: 'var(--color-text-subtle)' }}>Sin entrada</span>}
                  <button onClick={() => openEdit(r)} className="ml-auto p-1 rounded hover:bg-[var(--color-surface)] transition-colors"
                    style={{ color: 'var(--color-text-subtle)' }}>
                    <Pencil size={11} />
                  </button>
                </div>
              ))}
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit record modal */}
      <Modal open={!!editRecord} onClose={() => setEditRecord(null)} title="Editar registro" size="sm">
        {editRecord && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {editRecord.user?.name} — {new Date(editRecord.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
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

      {/* Mark absent modal */}
      <Modal open={!!absenteModal} onClose={() => setAbsenteModal(null)} title="Marcar ausencia" size="sm">
        {absenteModal && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Marcá una ausencia para <strong>{absenteModal.name}</strong>:
            </p>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                <Calendar size={11} className="inline mr-1" />Fecha
              </label>
              <input type="date" value={absenteDate} onChange={e => setAbsenteDate(e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 transition-all"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
            </div>
            <ModalFooter>
              <Button variant="ghost" onClick={() => setAbsenteModal(null)}>Cancelar</Button>
              <Button variant="danger" leftIcon={<X size={14} />} onClick={handleMarkAbsent} loading={markingAbs}>
                Confirmar ausencia
              </Button>
            </ModalFooter>
          </div>
        )}
      </Modal>
    </div>
  )
}
