'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Save, CheckSquare, Square, Calendar, User,
  Building2, Flag, Trash2, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { formatDate, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import type { Task, TaskStatus, TaskPriority } from '@/types'
import toast from 'react-hot-toast'

const PRIORITY_OPTIONS = [
  { value: 'BAJA',    label: 'Baja' },
  { value: 'MEDIA',   label: 'Media' },
  { value: 'ALTA',    label: 'Alta' },
  { value: 'URGENTE', label: 'Urgente' },
]
const STATUS_OPTIONS = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'EN_CURSO',  label: 'En curso'  },
  { value: 'HECHA',     label: 'Hecha'     },
]
const PRIORITY_COLORS: Record<TaskPriority, 'neutral'|'info'|'warning'|'danger'> = {
  BAJA: 'neutral', MEDIA: 'info', ALTA: 'warning', URGENTE: 'danger',
}

export default function TareaDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const qc       = useQueryClient()
  const { user } = useAuthStore()

  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm]         = useState<Partial<Task & { dueDate: string }>>({})
  const [dirty, setDirty]       = useState(false)

  const { data: task, isLoading } = useQuery<Task>({
    queryKey: ['task', id],
    queryFn: async () => {
      const res = await fetch(`/api/tareas/${id}`)
      if (!res.ok) throw new Error('Tarea no encontrada')
      return res.json().then((j: { data: Task }) => j.data)
    },
  })

  const { data: usersData } = useQuery({
    queryKey: ['usuarios-internos'],
    queryFn: async () => {
      const res = await fetch('/api/usuarios')
      if (!res.ok) return { data: [] }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
  const users: Array<{ id: string; name: string }> = usersData?.data ?? []

  const { data: empresasData } = useQuery({
    queryKey: ['empresas-tareas'],
    queryFn: async () => {
      const res = await fetch('/api/empresas?limit=200')
      if (!res.ok) return { data: [] }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
  const empresas: Array<{ id: string; name: string }> = empresasData?.data ?? []

  // Sync form when task loads
  useEffect(() => {
    if (task && !dirty) {
      setForm({
        title:        task.title,
        description:  task.description ?? '',
        status:       task.status,
        priority:     task.priority,
        dueDate:      task.dueDate ? task.dueDate.split('T')[0] : '',
        assignedToId: task.assignedToId,
        empresaId:    task.empresaId ?? '',
      })
    }
  }, [task, dirty])

  // Auto-mark as viewed when the assignee opens the task
  useEffect(() => {
    if (!task || !user) return
    if (task.assignedToId === user.id && !(task as any).viewedAt) {
      fetch(`/api/tareas/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ viewed: true }),
      }).then(() => qc.invalidateQueries({ queryKey: ['tasks'] }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, user?.id])

  const handleSave = async () => {
    if (!form.title?.trim()) { toast.error('El título es requerido'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/tareas/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:        form.title?.trim(),
          description:  form.description || null,
          status:       form.status,
          priority:     form.priority,
          dueDate:      form.dueDate || null,
          assignedToId: form.assignedToId || user?.id,
          empresaId:    (form as any).empresaId || null,
        }),
      })
      if (!res.ok) { const j = await res.json(); toast.error(j.error); return }
      toast.success('Tarea actualizada')
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['task', id] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    } catch { toast.error('Error') } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm('¿Eliminar esta tarea?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/tareas/${id}`, { method: 'DELETE' })
      if (res.ok) { toast.success('Tarea eliminada'); qc.invalidateQueries({ queryKey: ['tasks'] }); router.push('/tareas') }
      else { const j = await res.json(); toast.error(j.error) }
    } catch { toast.error('Error') } finally { setDeleting(false) }
  }

  const toggleStatus = () => {
    const next: TaskStatus = form.status === 'HECHA' ? 'PENDIENTE' : 'HECHA'
    setForm(f => ({ ...f, status: next })); setDirty(true)
  }

  const upd = (key: string, val: string) => { setForm(f => ({ ...f, [key]: val })); setDirty(true) }

  if (isLoading) return (
    <div className="space-y-4 max-w-2xl">
      <div className="h-8 w-40 rounded animate-pulse" style={{ background: 'var(--color-border)' }} />
      <div className="h-48 rounded-2xl animate-pulse" style={{ background: 'var(--color-border)' }} />
    </div>
  )

  if (!task) return (
    <div className="text-center py-20" style={{ color: 'var(--color-text-muted)' }}>
      Tarea no encontrada.
      <Button variant="ghost" className="ml-2" onClick={() => router.push('/tareas')}>Volver</Button>
    </div>
  )

  const isOverdue = task.dueDate && task.status !== 'HECHA' && new Date(task.dueDate) < new Date()

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/tareas')}
          className="flex items-center gap-2 text-sm hover:opacity-80 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}>
          <ArrowLeft size={15} /> Tareas
        </button>
        <div className="flex gap-2">
          {dirty && (
            <Button size="sm" onClick={handleSave} loading={saving} leftIcon={<Save size={13} />}>
              Guardar
            </Button>
          )}
          <Button size="sm" variant="danger" onClick={handleDelete} disabled={deleting} leftIcon={<Trash2 size={13} />}>
            Eliminar
          </Button>
        </div>
      </div>

      {/* Main card */}
      <div className="rounded-2xl p-5 space-y-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        {/* Title + status toggle */}
        <div className="flex items-start gap-3">
          <button onClick={toggleStatus} className="mt-1 shrink-0 transition-colors"
            style={{ color: form.status === 'HECHA' ? '#10b981' : 'var(--color-text-subtle)' }}>
            {form.status === 'HECHA' ? <CheckSquare size={22} /> : <Square size={22} />}
          </button>
          <input
            type="text"
            value={form.title ?? ''}
            onChange={e => upd('title', e.target.value)}
            className={`flex-1 text-lg font-bold bg-transparent outline-none border-none resize-none ${form.status === 'HECHA' ? 'line-through opacity-60' : ''}`}
            style={{ color: 'var(--color-text)' }}
            placeholder="Título de la tarea"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Descripción</label>
          <textarea
            rows={4}
            value={form.description ?? ''}
            onChange={e => upd('description', e.target.value)}
            placeholder="Detalles, contexto, pasos a seguir..."
            className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all"
            style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
        </div>

        {/* Fields grid */}
        <div className="grid grid-cols-2 gap-3">
          <Select label="Estado" options={STATUS_OPTIONS} value={form.status ?? 'PENDIENTE'}
            onChange={e => upd('status', e.target.value)} />
          <Select label="Prioridad" options={PRIORITY_OPTIONS} value={form.priority ?? 'MEDIA'}
            onChange={e => upd('priority', e.target.value)} />
          <Input label="Fecha límite" type="date" value={(form as any).dueDate ?? ''}
            onChange={e => upd('dueDate', e.target.value)} />
          <Select
            label="Asignado a"
            options={[{ value: '', label: 'Yo mismo' }, ...users.map(u => ({ value: u.id, label: u.name }))]}
            value={form.assignedToId ?? ''}
            onChange={e => upd('assignedToId', e.target.value)}
          />
        </div>

        <Select
          label="Empresa (opcional)"
          options={[{ value: '', label: 'Sin empresa' }, ...empresas.map(e => ({ value: e.id, label: e.name }))]}
          value={(form as any).empresaId ?? ''}
          onChange={e => upd('empresaId', e.target.value)}
        />
      </div>

      {/* Meta info */}
      <div className="rounded-xl px-4 py-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs"
        style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
        <span className="flex items-center gap-1"><User size={11} />Creada por {task.createdBy?.name ?? '—'}</span>
        <span className="flex items-center gap-1"><Clock size={11} />{timeAgo(task.createdAt)}</span>
        {task.completedAt && <span className="flex items-center gap-1 text-emerald-400"><CheckSquare size={11} />Completada {timeAgo(task.completedAt)}</span>}
        {isOverdue && <span className="text-red-400 flex items-center gap-1"><Flag size={11} />Vencida desde {formatDate(task.dueDate!)}</span>}
        {task.empresa && (
          <span className="flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
            <Building2 size={11} />{task.empresa.name}
          </span>
        )}
      </div>

      {dirty && (
        <div className="flex justify-end">
          <Button onClick={handleSave} loading={saving} leftIcon={<Save size={14} />}>
            Guardar cambios
          </Button>
        </div>
      )}
    </div>
  )
}
