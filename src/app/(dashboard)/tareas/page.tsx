'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, CheckSquare, Square, Clock, AlertCircle, ChevronDown, Trash2,
  User, Calendar, Flag, Building2, Search, Eye, EyeOff, Activity, X,
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
  empresaId: string
}

const EMPTY_FORM: TaskFormState = {
  title: '', description: '', priority: 'MEDIA', dueDate: '', assignedToId: '', empresaId: '',
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.status === 'HECHA') return false
  return new Date(task.dueDate) < new Date()
}

export default function TareasPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()

  const [statusFilter, setStatusFilter] = useState('')
  const [searchInput,  setSearchInput]  = useState('')
  const [search,       setSearch]       = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])
  const [form, setForm] = useState<TaskFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

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
  const userOptions = [
    { value: '', label: 'Yo mismo' },
    ...users.map(u => ({ value: u.id, label: u.name })),
  ]

  // Empresa combobox state
  const [empresaSearch, setEmpresaSearch]     = useState('')
  const [empresaOpen,   setEmpresaOpen]       = useState(false)
  const [empresaLabel,  setEmpresaLabel]      = useState('')
  const empresaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (empresaRef.current && !empresaRef.current.contains(e.target as Node)) {
        setEmpresaOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data: empresasData } = useQuery({
    queryKey: ['empresas-search', empresaSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '20' })
      if (empresaSearch.length >= 1) params.set('search', empresaSearch)
      const res = await fetch(`/api/empresas?${params}`)
      if (!res.ok) return { data: [] }
      return res.json()
    },
    staleTime: 30_000,
    enabled: empresaOpen,
  })
  const empresaResults: Array<{ id: string; name: string }> = empresasData?.data ?? []

  const { data, isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter)    params.set('status', statusFilter)
      if (search.length >= 2) params.set('search', search)
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
    const json = await res.json()
    if (res.ok) {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      toast.success('Tarea eliminada')
    } else {
      toast.error(json.error ?? 'Sin permisos para eliminar esta tarea')
    }
  }

  const canDelete = (task: Task) =>
    user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || task.createdById === user?.id

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
          empresaId: form.empresaId || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success('Tarea creada')
      setForm(EMPTY_FORM)
      setEmpresaSearch('')
      setEmpresaLabel('')
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
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)] pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar tareas..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 w-44"
            />
          </div>
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
          <p className="text-[var(--color-text-muted)]">No hay tareas{statusFilter || search ? ' con estos filtros' : ' aún'}</p>
          <Button className="mt-4" leftIcon={<Plus size={14} />} onClick={() => setShowForm(true)}>
            Crear primera tarea
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
            {tasks.map((task) => {
              const overdue = isOverdue(task)
              return (
                <div
                  key={task.id}
                  className={`list-appear surface rounded-xl px-4 py-3 flex items-start gap-3 group transition-opacity ${
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
                      {(task.empresa || task.client) && (
                        <span className="text-[10px] text-[var(--color-text-subtle)] flex items-center gap-1">
                          <Building2 size={9} />{task.empresa?.name ?? task.client?.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Read/active indicators (visible to task creator) */}
                  {task.createdById === user?.id && task.assignedToId !== user?.id && task.status !== 'HECHA' && (
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {task.status === 'EN_CURSO' ? (
                        <span title="Asignado trabajando activamente" className="text-emerald-400 animate-pulse">
                          <Activity size={13} />
                        </span>
                      ) : (task as any).viewedAt ? (
                        <span title={`Visto · ${timeAgo((task as any).viewedAt)}`} className="text-blue-400">
                          <Eye size={13} />
                        </span>
                      ) : (
                        <span title="Aún no visto por el asignado" style={{ color: 'var(--color-text-subtle)' }}>
                          <EyeOff size={13} />
                        </span>
                      )}
                    </div>
                  )}

                  {canDelete(task) && (
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--color-text-subtle)] hover:text-red-400 transition-all shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )
            })}
        </div>
      )}

      {/* Create task modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setEmpresaSearch(''); setEmpresaLabel(''); setForm(EMPTY_FORM) }} title="Nueva Tarea" size="sm">
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
            <div className="flex flex-col gap-1.5" ref={empresaRef}>
              <label className="text-sm font-medium text-[var(--color-text-muted)]">Empresa (opcional)</label>
              <div className="relative">
                <div
                  className="flex items-center gap-1.5 w-full rounded-xl border px-3 py-2 text-sm cursor-text"
                  style={{
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                  }}
                  onClick={() => { setEmpresaOpen(true); setEmpresaSearch('') }}
                >
                  {form.empresaId ? (
                    <>
                      <span className="flex-1 truncate">{empresaLabel}</span>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          setForm(f => ({ ...f, empresaId: '' }))
                          setEmpresaLabel('')
                          setEmpresaSearch('')
                        }}
                        className="shrink-0 text-[var(--color-text-subtle)] hover:text-red-400 transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <input
                      className="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--color-text-subtle)]"
                      placeholder="Buscar empresa..."
                      value={empresaSearch}
                      onChange={e => { setEmpresaSearch(e.target.value); setEmpresaOpen(true) }}
                      onFocus={() => setEmpresaOpen(true)}
                    />
                  )}
                </div>

                {empresaOpen && (
                  <div
                    className="absolute z-50 w-full mt-1 rounded-xl shadow-lg overflow-hidden"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                  >
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface-raised)] transition-colors"
                      style={{ color: 'var(--color-text-muted)' }}
                      onClick={() => {
                        setForm(f => ({ ...f, empresaId: '' }))
                        setEmpresaLabel('')
                        setEmpresaSearch('')
                        setEmpresaOpen(false)
                      }}
                    >
                      Sin empresa
                    </button>
                    <div className="max-h-44 overflow-y-auto">
                      {empresaResults.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                          {empresaSearch.length >= 1 ? 'Sin resultados' : 'Escribí para buscar...'}
                        </p>
                      ) : (
                        empresaResults.map(e => (
                          <button
                            key={e.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface-raised)] transition-colors truncate"
                            style={{ color: 'var(--color-text)' }}
                            onClick={() => {
                              setForm(f => ({ ...f, empresaId: e.id }))
                              setEmpresaLabel(e.name)
                              setEmpresaSearch('')
                              setEmpresaOpen(false)
                            }}
                          >
                            {e.name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
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
