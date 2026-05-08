'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, CheckSquare, Square, Clock, AlertCircle, ChevronDown, Trash2,
  User, Calendar, Flag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import type { Task, TaskStatus, TaskPriority } from '@/types'
import toast from 'react-hot-toast'

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  BAJA:    'neutral',
  MEDIA:   'info',
  ALTA:    'warning',
  URGENTE: 'danger',
}

const PRIORITY_OPTIONS = [
  { value: 'BAJA', label: 'Baja' },
  { value: 'MEDIA', label: 'Media' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'URGENTE', label: 'Urgente' },
]

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'PENDIENTE', label: 'Pendientes' },
  { value: 'EN_CURSO', label: 'En curso' },
  { value: 'HECHA', label: 'Completadas' },
]

interface TaskFormState {
  title: string
  description: string
  priority: TaskPriority
  dueDate: string
  assignedToId: string
  clientId: string
}

const EMPTY_FORM: TaskFormState = {
  title: '', description: '', priority: 'MEDIA', dueDate: '', assignedToId: '', clientId: '',
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.status === 'HECHA') return false
  return new Date(task.dueDate) < new Date()
}

export default function TareasPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()

  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<TaskFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await fetch('/api/settings/users')
      if (!res.ok) return { data: [] }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
  const users: Array<{ id: string; name: string }> = usersData?.data ?? []
  const userOptions = [
    { value: '', label: 'Yo mismo' },
    ...users.map(u => ({ value: u.id, label: u.name })),
  ]

  const { data: clientsData } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const res = await fetch('/api/clients?limit=100')
      if (!res.ok) return { data: [] }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
  const clientOptions = [
    { value: '', label: 'Sin cliente' },
    ...((clientsData?.data ?? []) as Array<{ id: string; name: string }>).map(c => ({ value: c.id, label: c.name })),
  ]

  const { data, isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/tareas?${params}`)
      if (!res.ok) throw new Error('Error al cargar tareas')
      return res.json().then(j => j.data)
    },
    staleTime: 30 * 1000,
  })

  const tasks = data ?? []

  const toggleStatus = async (task: Task) => {
    const newStatus: TaskStatus = task.status === 'HECHA' ? 'PENDIENTE' : 'HECHA'
    const res = await fetch(`/api/tareas/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) qc.invalidateQueries({ queryKey: ['tasks'] })
    else toast.error('Error al actualizar')
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/tareas/${id}`, { method: 'DELETE' })
    if (res.ok) {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      toast.success('Tarea eliminada')
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('El título es requerido'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/tareas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          priority: form.priority,
          dueDate: form.dueDate || null,
          assignedToId: form.assignedToId || user?.id,
          clientId: form.clientId || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success('Tarea creada')
      setForm(EMPTY_FORM)
      setShowForm(false)
      qc.invalidateQueries({ queryKey: ['tasks'] })
    } catch { toast.error('Error') } finally { setSaving(false) }
  }

  const pendingCount = tasks.filter(t => t.status !== 'HECHA').length
  const overdueCount = tasks.filter(t => isOverdue(t)).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Tareas</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5 flex items-center gap-3">
            <span>{pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}</span>
            {overdueCount > 0 && (
              <span className="text-red-400 flex items-center gap-1">
                <AlertCircle size={12} />{overdueCount} vencida{overdueCount !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-36"
          />
          <Button leftIcon={<Plus size={16} />} onClick={() => setShowForm(true)}>
            Nueva Tarea
          </Button>
        </div>
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="surface rounded-2xl p-16 text-center">
          <CheckSquare className="mx-auto mb-3 text-[var(--color-text-subtle)]" size={40} />
          <p className="text-[var(--color-text-muted)]">No hay tareas{statusFilter ? ' con este filtro' : ' aún'}</p>
          <Button className="mt-4" leftIcon={<Plus size={14} />} onClick={() => setShowForm(true)}>
            Crear primera tarea
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {tasks.map((task) => {
              const overdue = isOverdue(task)
              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={`surface rounded-xl px-4 py-3 flex items-start gap-3 group transition-opacity ${
                    task.status === 'HECHA' ? 'opacity-60' : ''
                  }`}
                >
                  <button
                    onClick={() => toggleStatus(task)}
                    className={`mt-0.5 shrink-0 transition-colors ${
                      task.status === 'HECHA' ? 'text-emerald-400' : 'text-[var(--color-text-subtle)] hover:text-[var(--color-primary)]'
                    }`}
                  >
                    {task.status === 'HECHA'
                      ? <CheckSquare size={18} />
                      : <Square size={18} />
                    }
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm font-medium ${task.status === 'HECHA' ? 'line-through text-[var(--color-text-subtle)]' : 'text-[var(--color-text)]'}`}>
                        {task.title}
                      </span>
                      <Badge
                        variant={PRIORITY_COLORS[task.priority] as 'neutral' | 'info' | 'warning' | 'danger'}
                        size="sm"
                      >
                        {task.priority}
                      </Badge>
                      {overdue && (
                        <Badge variant="danger" size="sm" dot>Vencida</Badge>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-xs text-[var(--color-text-subtle)] mt-0.5">{task.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                      {task.assignedTo && (
                        <span className="text-[10px] text-[var(--color-text-subtle)] flex items-center gap-1">
                          <User size={9} />{task.assignedTo.name}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className={`text-[10px] flex items-center gap-1 ${overdue ? 'text-red-400' : 'text-[var(--color-text-subtle)]'}`}>
                          <Calendar size={9} />{formatDate(task.dueDate)}
                        </span>
                      )}
                      {task.client && (
                        <span className="text-[10px] text-[var(--color-text-subtle)] flex items-center gap-1">
                          <Flag size={9} />{task.client.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(task.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--color-text-subtle)] hover:text-red-400 transition-all shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Create task modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nueva Tarea" size="sm">
        <form onSubmit={handleCreate} className="space-y-3">
          <Input
            label="Título *"
            placeholder="Llamar a cliente, enviar propuesta..."
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-muted)]">Descripción</label>
            <textarea
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Prioridad"
              options={PRIORITY_OPTIONS}
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: e.target.value as TaskPriority }))}
            />
            <Input
              label="Fecha límite"
              type="date"
              value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Asignar a"
              options={userOptions}
              value={form.assignedToId}
              onChange={e => setForm(f => ({ ...f, assignedToId: e.target.value }))}
            />
            <Select
              label="Cliente (opcional)"
              options={clientOptions}
              value={form.clientId}
              onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Crear Tarea</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
