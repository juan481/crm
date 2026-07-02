'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion' // solo para modal
import {
  CheckSquare, Square, Headphones, Plus, Calculator,
  AlertCircle, Clock, CheckCircle2, Zap, ChevronRight,
  Calendar, Flag, User, LogIn, LogOut, CheckCircle,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/store/auth-store'
import { formatDate } from '@/lib/utils'
import type { Task, Ticket, TaskStatus, TaskPriority, TicketCategory } from '@/types'
import toast from 'react-hot-toast'

const PRIORITY_BADGE: Record<TaskPriority, 'neutral' | 'info' | 'warning' | 'danger'> = {
  BAJA: 'neutral', MEDIA: 'info', ALTA: 'warning', URGENTE: 'danger',
}

const TICKET_STATUS_CONFIG = {
  ABIERTO:    { label: 'Abierto',     variant: 'danger'  as const, dot: true },
  EN_PROCESO: { label: 'En proceso',  variant: 'warning' as const, dot: true },
  ESPERANDO:  { label: 'Esperando',   variant: 'info'    as const, dot: true },
  RESUELTO:   { label: 'Resuelto',    variant: 'success' as const, dot: true },
  CERRADO:    { label: 'Cerrado',     variant: 'neutral' as const, dot: false },
}

const CATEGORY_OPTIONS = [
  { value: 'SOPORTE',    label: 'Soporte' },
  { value: 'BUG',        label: 'Bug / Falla' },
  { value: 'FACTURACION',label: 'Facturación' },
  { value: 'CONSULTA',   label: 'Consulta' },
]

const PRIORITY_OPTIONS = [
  { value: 'BAJA',    label: 'Baja' },
  { value: 'MEDIA',   label: 'Media' },
  { value: 'ALTA',    label: 'Alta' },
  { value: 'URGENTE', label: 'Urgente' },
]

interface TicketForm {
  title: string
  description: string
  category: TicketCategory
  priority: TaskPriority
  clientId: string
}

const EMPTY_TICKET: TicketForm = {
  title: '', description: '', category: 'SOPORTE', priority: 'MEDIA', clientId: '',
}

export default function MiDiaPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [ticketOpen, setTicketOpen] = useState(false)
  const [ticketForm, setTicketForm] = useState<TicketForm>(EMPTY_TICKET)
  const [saving, setSaving] = useState(false)

  // Check-in widget state
  const [checkingIn,  setCheckingIn]  = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const hoy = new Date().toISOString().slice(0, 10)
  const mesCurrent = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  const { data: asistenciaHoy, refetch: refetchAsistencia } = useQuery({
    queryKey: ['asistencia-hoy'],
    queryFn:  async () => {
      const r = await fetch(`/api/asistencia?mes=${mesCurrent}`)
      if (!r.ok) return null
      const records = ((await r.json()).data ?? []) as Array<{ fecha: string; horaEntrada: string | null; horaSalida: string | null; tardanza: boolean }>
      return records.find(r => r.fecha.slice(0, 10) === hoy) ?? null
    },
    staleTime: 30_000,
  })

  const handleCheckIn = async () => {
    setCheckingIn(true)
    try {
      const res  = await fetch('/api/asistencia/check-in', { method: 'POST' })
      const json = await res.json()
      if (res.status === 409) { toast.error(json.error); refetchAsistencia(); return }
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success(json.tardanza ? '⚠️ Entrada con tardanza' : '✅ Entrada registrada')
      refetchAsistencia()
    } catch { toast.error('Error de conexión') }
    finally { setCheckingIn(false) }
  }

  const handleCheckOut = async () => {
    setCheckingOut(true)
    try {
      const res  = await fetch('/api/asistencia/check-out', { method: 'POST' })
      const json = await res.json()
      if (res.status === 409) { toast.error(json.error); refetchAsistencia(); return }
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success(`Hasta luego! ${json.horasTrabajadas}`)
      refetchAsistencia()
    } catch { toast.error('Error de conexión') }
    finally { setCheckingOut(false) }
  }

  const formatHora = (dt: string | null) => dt ? new Date(dt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—'

  const today = new Date()
  const dayName  = format(today, 'EEEE', { locale: es })
  const dayFull  = format(today, "d 'de' MMMM", { locale: es })

  // Today's tasks assigned to me
  const { data: tasksData, isLoading: loadingTasks } = useQuery<Task[]>({
    queryKey: ['my-tasks'],
    queryFn: async () => {
      const res = await fetch('/api/tareas?status=PENDIENTE&status=EN_CURSO')
      if (!res.ok) return []
      const json = await res.json()
      return json.data ?? []
    },
    staleTime: 30 * 1000,
  })

  // Open tickets assigned to me
  const { data: ticketsData, isLoading: loadingTickets } = useQuery<Ticket[]>({
    queryKey: ['my-tickets'],
    queryFn: async () => {
      const res = await fetch('/api/tickets?status=ABIERTO&status=EN_PROCESO')
      if (!res.ok) return []
      const json = await res.json()
      return json.data ?? []
    },
    staleTime: 30 * 1000,
  })

  // Clients for ticket creation
  const { data: clientsData } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const res = await fetch('/api/clients?limit=200')
      const json = await res.json()
      return (json.data ?? []) as Array<{ id: string; name: string }>
    },
    staleTime: 5 * 60 * 1000,
  })

  const tasks   = (tasksData ?? []).filter(t => t.assignedToId === user?.id || !t.assignedToId)
  const tickets = (ticketsData ?? []).filter(t => t.assignedToId === user?.id || !t.assignedToId)
  const clients = clientsData ?? []

  const todayTasks     = tasks.filter(t => {
    if (!t.dueDate) return true
    const due = new Date(t.dueDate)
    return due.toDateString() === today.toDateString() || due < today
  })
  const pendingCount  = tasks.filter(t => t.status !== 'HECHA').length
  const urgentCount   = tasks.filter(t => t.priority === 'URGENTE' && t.status !== 'HECHA').length

  const toggleTask = async (task: Task) => {
    const newStatus: TaskStatus = task.status === 'HECHA' ? 'PENDIENTE' : 'HECHA'
    const res = await fetch(`/api/tareas/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) qc.invalidateQueries({ queryKey: ['my-tasks'] })
    else toast.error('Error al actualizar')
  }

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ticketForm.title.trim()) { toast.error('El título es requerido'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       ticketForm.title.trim(),
          description: ticketForm.description.trim() || '',
          category:    ticketForm.category,
          priority:    ticketForm.priority,
          clientId:    ticketForm.clientId || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success('Ticket creado')
      setTicketForm(EMPTY_TICKET)
      setTicketOpen(false)
      qc.invalidateQueries({ queryKey: ['my-tickets'] })
    } catch { toast.error('Error') } finally { setSaving(false) }
  }

  const greeting = () => {
    const h = today.getHours()
    if (h < 12) return 'Buenos días'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  }

  return (
    <div className="space-y-6 pb-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)] capitalize mb-1">{dayName}</p>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{greeting()}, {user?.name?.split(' ')[0]}</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{dayFull} · Tu agenda de hoy</p>
      </div>

      {/* ── Stats rápidos ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Tareas',    value: pendingCount,      color: 'text-blue-400',   bg: 'bg-blue-500/10',   icon: <CheckSquare size={16} /> },
          { label: 'Urgentes',  value: urgentCount,       color: 'text-red-400',    bg: 'bg-red-500/10',    icon: <AlertCircle size={16} /> },
          { label: 'Tickets',   value: tickets.length,    color: 'text-amber-400',  bg: 'bg-amber-500/10',  icon: <Headphones size={16} /> },
        ].map((stat) => (
          <div
            key={stat.label}
            className="list-appear surface rounded-2xl p-4 flex flex-col items-center text-center gap-1.5"
          >
            <div className={`w-8 h-8 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
              {stat.icon}
            </div>
            <p className="text-xl font-bold text-[var(--color-text)]">{stat.value}</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Check-in widget ──────────────────────────────────────────────── */}
      <div className="surface rounded-2xl p-4 flex items-center gap-4"
        style={{ border: asistenciaHoy?.horaSalida ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--color-border)' }}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: asistenciaHoy?.horaSalida ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)' }}>
          {asistenciaHoy?.horaSalida
            ? <CheckCircle size={20} style={{ color: '#10b981' }} />
            : asistenciaHoy?.horaEntrada
              ? <LogOut size={20} style={{ color: 'var(--color-primary)' }} />
              : <LogIn size={20} style={{ color: 'var(--color-primary)' }} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
            {asistenciaHoy?.horaSalida ? '¡Jornada completa!' : asistenciaHoy?.horaEntrada ? 'En jornada' : 'Asistencia'}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {asistenciaHoy?.horaEntrada
              ? `Entrada: ${formatHora(asistenciaHoy.horaEntrada)}${asistenciaHoy.horaSalida ? ` · Salida: ${formatHora(asistenciaHoy.horaSalida)}` : ''}`
              : 'No registraste entrada hoy'
            }
            {asistenciaHoy?.tardanza && <span className="ml-2" style={{ color: '#f59e0b' }}>Tardanza</span>}
          </p>
        </div>
        {!asistenciaHoy?.horaSalida && (
          asistenciaHoy?.horaEntrada
            ? <Button size="sm" variant="outline" leftIcon={<LogOut size={13} />} onClick={handleCheckOut} loading={checkingOut}>Salida</Button>
            : <Button size="sm" leftIcon={<LogIn size={13} />} onClick={handleCheckIn} loading={checkingIn}>Entrada</Button>
        )}
      </div>

      {/* ── Acceso rápido cotizador ─────────────────────────────────────── */}
      <Link
        href="/cotizador"
        className="surface rounded-2xl p-4 flex items-center gap-4 hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/5 transition-all group"
      >
        <div className="w-11 h-11 rounded-xl gradient-bg flex items-center justify-center shrink-0">
          <Zap size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
            Cotizador rápido
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">Armá un presupuesto en segundos</p>
        </div>
        <ChevronRight size={16} className="text-[var(--color-text-subtle)] group-hover:text-[var(--color-primary)] transition-colors" />
      </Link>

      {/* ── Mis Tareas ──────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckSquare size={16} className="text-[var(--color-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Mis Tareas</h2>
          </div>
          <Link href="/tareas" className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1">
            Ver todas <ChevronRight size={11} />
          </Link>
        </div>

        {loadingTasks ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : todayTasks.length === 0 ? (
          <div className="surface rounded-2xl p-8 text-center">
            <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400 opacity-60" />
            <p className="text-sm text-[var(--color-text-muted)]">Todo al día — sin tareas pendientes</p>
          </div>
        ) : (
          <div className="space-y-2">
              {todayTasks.map((task) => {
                const overdue = task.dueDate && new Date(task.dueDate) < today && task.status !== 'HECHA'
                return (
                  <div
                    key={task.id}
                    className={`list-appear surface rounded-xl px-4 py-3.5 flex items-start gap-3 transition-opacity ${
                      task.status === 'HECHA' ? 'opacity-50' : ''
                    }`}
                  >
                    <button
                      onClick={() => toggleTask(task)}
                      className={`mt-0.5 shrink-0 transition-colors ${
                        task.status === 'HECHA'
                          ? 'text-emerald-400'
                          : 'text-[var(--color-text-subtle)] hover:text-[var(--color-primary)]'
                      }`}
                    >
                      {task.status === 'HECHA' ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                        <span className={`text-sm font-medium ${task.status === 'HECHA' ? 'line-through text-[var(--color-text-subtle)]' : 'text-[var(--color-text)]'}`}>
                          {task.title}
                        </span>
                        <Badge variant={PRIORITY_BADGE[task.priority]} size="sm">{task.priority}</Badge>
                        {overdue && <Badge variant="danger" size="sm" dot>Vencida</Badge>}
                      </div>
                      {task.description && (
                        <p className="text-xs text-[var(--color-text-subtle)] line-clamp-1">{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        {task.dueDate && (
                          <span className={`text-[10px] flex items-center gap-0.5 ${overdue ? 'text-red-400' : 'text-[var(--color-text-subtle)]'}`}>
                            <Calendar size={9} />{formatDate(task.dueDate)}
                          </span>
                        )}
                        {task.client && (
                          <span className="text-[10px] text-[var(--color-text-subtle)] flex items-center gap-0.5">
                            <Flag size={9} />{task.client.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </section>

      {/* ── Mis Tickets ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Headphones size={16} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Tickets activos</h2>
          </div>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Plus size={13} />}
            onClick={() => setTicketOpen(true)}
          >
            Nuevo
          </Button>
        </div>

        {loadingTickets ? (
          <div className="space-y-2">
            {[1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : tickets.length === 0 ? (
          <div className="surface rounded-2xl p-6 text-center">
            <Headphones size={28} className="mx-auto mb-2 text-[var(--color-text-subtle)] opacity-50" />
            <p className="text-sm text-[var(--color-text-muted)]">No tenés tickets activos</p>
            <button
              onClick={() => setTicketOpen(true)}
              className="mt-3 text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1 mx-auto"
            >
              <Plus size={11} />Cargar ticket
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => {
              const cfg = TICKET_STATUS_CONFIG[ticket.status]
              return (
                <div
                  key={ticket.id}
                  className="list-appear surface rounded-xl px-4 py-3.5 flex items-start gap-3"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Headphones size={15} className="text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs font-mono text-[var(--color-text-subtle)]">#{ticket.number}</span>
                      <p className="text-sm font-medium text-[var(--color-text)] truncate flex-1">{ticket.title}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={cfg.variant} size="sm" dot={cfg.dot}>{cfg.label}</Badge>
                      {ticket.client && (
                        <span className="text-[10px] text-[var(--color-text-subtle)] flex items-center gap-0.5">
                          <User size={9} />{ticket.client.name}
                        </span>
                      )}
                      <span className="text-[10px] text-[var(--color-text-subtle)]">{ticket.category}</span>
                    </div>
                  </div>
                </div>
              )
            })}
            <Link
              href="/tickets"
              className="flex items-center justify-center gap-1 text-xs text-[var(--color-primary)] hover:underline py-2"
            >
              Ver todos los tickets <ChevronRight size={11} />
            </Link>
          </div>
        )}
      </section>

      {/* ── Create Ticket Modal ──────────────────────────────────────────── */}
      <Modal open={ticketOpen} onClose={() => setTicketOpen(false)} title="Nuevo Ticket" size="sm">
        <form onSubmit={handleCreateTicket} className="space-y-3">
          <Input
            label="Título *"
            placeholder="Describe el problema brevemente"
            value={ticketForm.title}
            onChange={e => setTicketForm(f => ({ ...f, title: e.target.value }))}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-muted)]">Descripción</label>
            <textarea
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
              rows={3}
              placeholder="Detallá el problema, pasos para reproducirlo..."
              value={ticketForm.description}
              onChange={e => setTicketForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Categoría"
              options={CATEGORY_OPTIONS}
              value={ticketForm.category}
              onChange={e => setTicketForm(f => ({ ...f, category: e.target.value as TicketCategory }))}
            />
            <Select
              label="Prioridad"
              options={PRIORITY_OPTIONS}
              value={ticketForm.priority}
              onChange={e => setTicketForm(f => ({ ...f, priority: e.target.value as TaskPriority }))}
            />
          </div>
          <Select
            label="Cliente (opcional)"
            options={[
              { value: '', label: 'Sin cliente' },
              ...clients.map(c => ({ value: c.id, label: c.name })),
            ]}
            value={ticketForm.clientId}
            onChange={e => setTicketForm(f => ({ ...f, clientId: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" type="button" onClick={() => setTicketOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Crear Ticket</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
