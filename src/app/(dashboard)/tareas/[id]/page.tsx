'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Save, CheckSquare, Square, Calendar, User,
  Building2, Flag, Trash2, Clock, Send, Paperclip, X, FileText, Image as ImageIcon, Plus,
  TrendingUp, LifeBuoy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { AvatarStack } from '@/components/ui/avatar-stack'
import { UserMultiSelect } from '@/components/ui/user-multi-select'
import { formatDate, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import { usePlugin } from '@/hooks/use-plugin'
import type { Task, TaskStatus, TaskPriority, TaskComment, TaskSubitem } from '@/types'
import toast from 'react-hot-toast'

function isImageFile(name?: string | null) { return !!name && /\.(png|jpe?g|webp)$/i.test(name) }

function TaskChecklist({ taskId }: { taskId: string }) {
  const qc = useQueryClient()
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)

  const { data, isLoading } = useQuery<TaskSubitem[]>({
    queryKey: ['task-subitems', taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tareas/${taskId}/subitems`)
      if (!res.ok) return []
      return (await res.json()).data
    },
    staleTime: 15 * 1000,
  })
  const items = data ?? []
  const done = items.filter((i) => i.done).length

  const toggle = async (item: TaskSubitem) => {
    qc.setQueryData<TaskSubitem[]>(['task-subitems', taskId], (old) =>
      old?.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)) ?? [])
    try {
      const res = await fetch(`/api/tareas/${taskId}/subitems/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !item.done }),
      })
      if (!res.ok) toast.error('No se pudo actualizar la subtarea')
    } catch { toast.error('Error de conexión') } finally {
      qc.invalidateQueries({ queryKey: ['task-subitems', taskId] })
    }
  }

  const remove = async (item: TaskSubitem) => {
    qc.setQueryData<TaskSubitem[]>(['task-subitems', taskId], (old) => old?.filter((i) => i.id !== item.id) ?? [])
    try {
      const res = await fetch(`/api/tareas/${taskId}/subitems/${item.id}`, { method: 'DELETE' })
      if (!res.ok) toast.error('No se pudo eliminar la subtarea')
    } catch { toast.error('Error de conexión') } finally {
      qc.invalidateQueries({ queryKey: ['task-subitems', taskId] })
    }
  }

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`/api/tareas/${taskId}/subitems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      })
      if (!res.ok) { const j = await res.json(); toast.error(j.error); return }
      setNewTitle('')
      qc.invalidateQueries({ queryKey: ['task-subitems', taskId] })
    } catch { toast.error('Error de conexión') } finally { setAdding(false) }
  }

  if (isLoading) return null

  return (
    <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-subtle)' }}>Subtareas</p>
        {items.length > 0 && <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{done}/{items.length}</span>}
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2.5 group">
              <button onClick={() => toggle(item)} className="shrink-0" style={{ color: item.done ? '#10b981' : 'var(--color-text-subtle)' }}>
                {item.done ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
              <span className={`flex-1 text-sm ${item.done ? 'line-through opacity-60' : ''}`} style={{ color: 'var(--color-text)' }}>
                {item.title}
              </span>
              <button onClick={() => remove(item)} className="opacity-0 group-hover:opacity-100 shrink-0 text-[var(--color-text-subtle)] hover:text-red-400 transition-opacity">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={add} className="flex items-center gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Agregar un paso..."
          className="flex-1 rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        />
        <button type="submit" disabled={adding || !newTitle.trim()} className="shrink-0 p-1.5 rounded-lg disabled:opacity-40 transition-colors" style={{ color: 'var(--color-primary)' }}>
          <Plus size={16} />
        </button>
      </form>
    </div>
  )
}

function TaskComments({ taskId }: { taskId: string }) {
  const qc = useQueryClient()
  const [content, setContent] = useState('')
  const [attachment, setAttachment] = useState<{ url: string; name: string } | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [sending, setSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useQuery<TaskComment[]>({
    queryKey: ['task-comments', taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tareas/${taskId}/comments`)
      if (!res.ok) return []
      return (await res.json()).data
    },
    staleTime: 15 * 1000,
  })
  const comments = data ?? []

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/tareas/${taskId}/upload`, { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al subir archivo'); return }
      setAttachment(json.data)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() && !attachment) return
    setSending(true)
    try {
      const res = await fetch(`/api/tareas/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), attachmentUrl: attachment?.url, attachmentName: attachment?.name }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      setContent('')
      setAttachment(null)
      qc.invalidateQueries({ queryKey: ['task-comments', taskId] })
    } catch { toast.error('Error de conexión') } finally { setSending(false) }
  }

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-subtle)' }}>
        Comentarios {comments.length > 0 && `(${comments.length})`}
      </p>

      {isLoading ? (
        <div className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--color-border)' }} />
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <Avatar name={c.user?.name ?? '?'} src={c.user?.avatarUrl ?? undefined} size="xs" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{c.user?.name ?? '—'}</span>
                  <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{timeAgo(c.createdAt)}</span>
                </div>
                {c.content && <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-muted)' }}>{c.content}</p>}
                {c.attachmentUrl && (
                  isImageFile(c.attachmentName) ? (
                    <a href={c.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block mt-2 max-w-[220px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.attachmentUrl} alt={c.attachmentName ?? 'adjunto'} className="rounded-lg border max-h-48 object-cover" style={{ borderColor: 'var(--color-border)' }} />
                    </a>
                  ) : (
                    <a href={c.attachmentUrl} target="_blank" rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                      <FileText size={12} />{c.attachmentName ?? 'Archivo'}
                    </a>
                  )
                )}
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-sm text-center py-2" style={{ color: 'var(--color-text-subtle)' }}>Sin comentarios todavía.</p>
          )}
        </div>
      )}

      <form onSubmit={handleSend} className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <textarea
          rows={2}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escribí un comentario..."
          className="w-full rounded-xl border px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        />
        {attachment && (
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-[var(--color-surface-raised)] w-fit">
            {isImageFile(attachment.name) ? <ImageIcon size={13} /> : <FileText size={13} />}
            <span className="max-w-[180px] truncate" style={{ color: 'var(--color-text-muted)' }}>{attachment.name}</span>
            <button type="button" onClick={() => setAttachment(null)} className="text-[var(--color-text-subtle)] hover:text-red-400"><X size={12} /></button>
          </div>
        )}
        <div className="flex items-center justify-between">
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFileSelect} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile || !!attachment}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            <Paperclip size={13} />
            {uploadingFile ? 'Subiendo...' : 'Adjuntar'}
          </button>
          <Button type="submit" size="sm" loading={sending} leftIcon={<Send size={13} />}>Comentar</Button>
        </div>
      </form>
    </div>
  )
}

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
  // El backend (PATCH /api/tareas/[id]) ignora en silencio cualquier campo
  // que no sea status/viewed cuando quien edita es TECHNICIAN — antes esta
  // pantalla igual mostraba todos los campos como editables, así que un
  // técnico podía cambiar título/prioridad/asignado, apretar Guardar, ver
  // "Tarea actualizada" y que en realidad ESE cambio puntual no se hubiera
  // aplicado (inconsistencia real entre lo que la UI deja hacer y lo que
  // el servidor acepta). Mismo criterio que ya usaba tickets/[id]/page.tsx
  // para su propio campo "Asignado a".
  const isTech = user?.role === 'TECHNICIAN'

  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm]         = useState<Partial<Task & { dueDate: string; collaboratorIds: string[] }>>({})
  const [dirty, setDirty]       = useState(false)
  const [syncingGcal, setSyncingGcal] = useState(false)
  const { enabled: gcalEnabled } = usePlugin('google-calendar')

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
  const users: Array<{ id: string; name: string; avatarUrl: string | null }> = usersData?.data ?? []

  const { data: empresasData } = useQuery({
    queryKey: ['empresas-tareas'],
    queryFn: async () => {
      const res = await fetch('/api/empresas/options')
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
        collaboratorIds: (task.collaborators ?? []).map(c => c.user.id),
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
          collaboratorIds: form.collaboratorIds ?? [],
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

  const handleAddToGoogleCalendar = async () => {
    setSyncingGcal(true)
    try {
      const res = await fetch(`/api/tareas/${id}/google-calendar`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al agregar a Google Calendar'); return }
      toast.success('Agregada a Google Calendar')
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSyncingGcal(false)
    }
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
  // Mismo criterio que el backend (PATCH /api/tareas/[id]): reasignar y
  // reescribir colaboradores son acciones de "dueño" — un SELLER que sólo
  // es colaborador (ni asignado, ni creador) no puede tocar esto, aunque sí
  // pueda editar el resto de la tarea. Sin esto, la UI dejaba interactuar
  // con esos dos campos y el servidor los ignoraba en silencio.
  const isOwnerOrCreator = task.assignedToId === user?.id || task.createdById === user?.id
  const canReassign = !isTech && (user?.role !== 'SELLER' || isOwnerOrCreator)

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
          {gcalEnabled && task.dueDate && (
            <Button size="sm" variant="outline" onClick={handleAddToGoogleCalendar} loading={syncingGcal} leftIcon={<Calendar size={13} />}>
              Google Calendar
            </Button>
          )}
          {dirty && (
            <Button size="sm" onClick={handleSave} loading={saving} leftIcon={<Save size={13} />}>
              Guardar
            </Button>
          )}
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
            // Bug real encontrado en auditoría: este botón se mostraba a
            // cualquiera que pudiera ver la tarea (ej. un TECHNICIAN con la
            // suya propia abierta desde Mi Día) aunque el backend
            // (DELETE /api/tareas/[id]) exige ADMIN+ — la lista /tareas SÍ
            // ocultaba el botón con este mismo chequeo (canDelete), pero el
            // detalle no lo replicaba. Antes: click → confirm() nativo → recién
            // ahí el 403, un dead-end de UX que sugiere una capacidad que no
            // existe.
            <Button size="sm" variant="danger" onClick={handleDelete} disabled={deleting} leftIcon={<Trash2 size={13} />}>
              Eliminar
            </Button>
          )}
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
          {isTech ? (
            <p className={`flex-1 text-lg font-bold ${form.status === 'HECHA' ? 'line-through opacity-60' : ''}`} style={{ color: 'var(--color-text)' }}>
              {form.title || 'Título de la tarea'}
            </p>
          ) : (
            <input
              type="text"
              value={form.title ?? ''}
              onChange={e => upd('title', e.target.value)}
              className={`flex-1 text-lg font-bold bg-transparent outline-none border-none resize-none ${form.status === 'HECHA' ? 'line-through opacity-60' : ''}`}
              style={{ color: 'var(--color-text)' }}
              placeholder="Título de la tarea"
            />
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Descripción</label>
          {isTech ? (
            <p className="text-sm whitespace-pre-wrap" style={{ color: form.description ? 'var(--color-text-muted)' : 'var(--color-text-subtle)' }}>
              {form.description || 'Sin descripción'}
            </p>
          ) : (
            <textarea
              rows={4}
              value={form.description ?? ''}
              onChange={e => upd('description', e.target.value)}
              placeholder="Detalles, contexto, pasos a seguir..."
              className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all"
              style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
          )}
        </div>

        {/* Fields grid — Estado es lo único que un TECHNICIAN puede tocar
            acá (el backend acepta status/viewed de un colaborador o el
            asignado; todo lo demás lo ignora en silencio si isTech). */}
        <div className="grid grid-cols-2 gap-3">
          <Select label="Estado" options={STATUS_OPTIONS} value={form.status ?? 'PENDIENTE'}
            onChange={e => upd('status', e.target.value)} />
          {isTech ? (
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-subtle)' }}>Prioridad</p>
              <p className="text-sm" style={{ color: 'var(--color-text)' }}>{PRIORITY_OPTIONS.find(o => o.value === form.priority)?.label ?? '—'}</p>
            </div>
          ) : (
            <Select label="Prioridad" options={PRIORITY_OPTIONS} value={form.priority ?? 'MEDIA'}
              onChange={e => upd('priority', e.target.value)} />
          )}
          {isTech ? (
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-subtle)' }}>Fecha límite</p>
              <p className="text-sm" style={{ color: 'var(--color-text)' }}>{(form as any).dueDate ? formatDate((form as any).dueDate) : 'Sin fecha'}</p>
            </div>
          ) : (
            <Input label="Fecha límite" type="date" value={(form as any).dueDate ?? ''}
              onChange={e => upd('dueDate', e.target.value)} />
          )}
          {!canReassign ? (
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-subtle)' }}>Asignado a</p>
              <p className="text-sm" style={{ color: 'var(--color-text)' }}>{task.assignedTo?.name ?? '—'}</p>
            </div>
          ) : (
            <Select
              label="Asignado a"
              options={[{ value: '', label: 'Yo mismo' }, ...users.map(u => ({ value: u.id, label: u.name }))]}
              value={form.assignedToId ?? ''}
              onChange={e => {
                const nextAssignee = e.target.value
                setForm(f => ({ ...f, assignedToId: nextAssignee, collaboratorIds: (f.collaboratorIds ?? []).filter(id => id !== nextAssignee) }))
                setDirty(true)
              }}
            />
          )}
        </div>

        {!canReassign ? (
          <div>
            <p className="text-xs mb-1" style={{ color: 'var(--color-text-subtle)' }}>Colaboradores</p>
            {(task.collaborators?.length ?? 0) > 0 ? (
              <AvatarStack size="xs" people={(task.collaborators ?? []).map(c => c.user)} />
            ) : (
              <p className="text-sm" style={{ color: 'var(--color-text-subtle)' }}>Nadie más</p>
            )}
          </div>
        ) : (
          <UserMultiSelect
            label="Colaboradores (opcional)"
            users={users}
            selectedIds={form.collaboratorIds ?? []}
            onChange={ids => { setForm(f => ({ ...f, collaboratorIds: ids })); setDirty(true) }}
            excludeId={form.assignedToId || user?.id}
          />
        )}

        {isTech ? (
          <div>
            <p className="text-xs mb-1" style={{ color: 'var(--color-text-subtle)' }}>Empresa</p>
            <p className="text-sm" style={{ color: 'var(--color-text)' }}>{task.empresa?.name ?? 'Sin empresa'}</p>
          </div>
        ) : (
          <Select
            label="Empresa (opcional)"
            options={[{ value: '', label: 'Sin empresa' }, ...empresas.map(e => ({ value: e.id, label: e.name }))]}
            value={(form as any).empresaId ?? ''}
            onChange={e => upd('empresaId', e.target.value)}
          />
        )}
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
        {task.deal && (
          <Link href="/pipeline" className="flex items-center gap-1 hover:underline" style={{ color: 'var(--color-primary)' }}>
            <TrendingUp size={11} />{task.deal.title}
          </Link>
        )}
        {task.ticket && (
          <Link href={`/tickets/${task.ticket.id}`} className="flex items-center gap-1 hover:underline" style={{ color: 'var(--color-primary)' }}>
            <LifeBuoy size={11} />Ticket #{String(task.ticket.number).padStart(4, '0')}
          </Link>
        )}
      </div>

      {dirty && (
        <div className="flex justify-end">
          <Button onClick={handleSave} loading={saving} leftIcon={<Save size={14} />}>
            Guardar cambios
          </Button>
        </div>
      )}

      <TaskChecklist taskId={task.id} />
      <TaskComments taskId={task.id} />
    </div>
  )
}
