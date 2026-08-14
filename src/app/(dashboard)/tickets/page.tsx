'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, MessageSquare, User, Clock, AlertCircle, Building2, Search, Link2,
  CheckCircle2, Loader2, Archive, ChevronRight, Inbox, TimerReset,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar } from '@/components/ui/avatar'
import { timeAgo } from '@/lib/utils'
import type { Ticket, TaskPriority, TicketStatus, TicketCategory } from '@/types'
import toast from 'react-hot-toast'

// Señal visual principal de la lista: color + ícono por estado, para que la
// cola de soporte se pueda escanear de un vistazo (antes todo era texto
// plano del mismo tamaño, sin jerarquía — "abierto" y "cerrado" pesaban
// igual en la pantalla).
const STATUS_META: Record<TicketStatus, { color: string; icon: typeof AlertCircle; label: string }> = {
  ABIERTO:    { color: '#ef4444', icon: AlertCircle,  label: 'Abierto' },
  EN_PROCESO: { color: '#f59e0b', icon: Loader2,      label: 'En proceso' },
  ESPERANDO:  { color: '#3b82f6', icon: Clock,         label: 'Esperando cliente' },
  RESUELTO:   { color: '#10b981', icon: CheckCircle2,  label: 'Resuelto' },
  CERRADO:    { color: '#64748b', icon: Archive,        label: 'Cerrado' },
}
const PRIORITY_LABELS: Record<TaskPriority, string> = {
  BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta', URGENTE: 'Urgente',
}
const PRIORITY_HEX: Record<TaskPriority, string> = {
  BAJA: '#64748b', MEDIA: '#3b82f6', ALTA: '#f59e0b', URGENTE: '#ef4444',
}
const CATEGORY_LABELS: Record<TicketCategory, string> = {
  SOPORTE: 'Soporte técnico', BUG: 'Bug / Error', FACTURACION: 'Facturación', CONSULTA: 'Consulta',
}

function isTicketOverdue(ticket: Ticket) {
  return !!ticket.slaDueAt
    && ticket.status !== 'RESUELTO' && ticket.status !== 'CERRADO'
    && new Date(ticket.slaDueAt).getTime() < Date.now()
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'ABIERTO', label: 'Abierto' },
  { value: 'EN_PROCESO', label: 'En proceso' },
  { value: 'ESPERANDO', label: 'Esperando cliente' },
  { value: 'RESUELTO', label: 'Resuelto' },
  { value: 'CERRADO', label: 'Cerrado' },
]

const CATEGORY_OPTIONS = [
  { value: '', label: 'Todas las categorías' },
  { value: 'SOPORTE', label: 'Soporte técnico' },
  { value: 'BUG', label: 'Bug / Error' },
  { value: 'FACTURACION', label: 'Facturación' },
  { value: 'CONSULTA', label: 'Consulta' },
]

const PRIORITY_OPTIONS = [
  { value: 'MEDIA', label: 'Media' },
  { value: 'BAJA', label: 'Baja' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'URGENTE', label: 'Urgente' },
]

interface TicketFormState {
  title: string
  description: string
  priority: TaskPriority
  category: TicketCategory
  empresaId: string
  recipientEmail: string
  recipientName: string
}

const EMPTY_FORM: TicketFormState = {
  title: '', description: '', priority: 'MEDIA', category: 'SOPORTE', empresaId: '', recipientEmail: '', recipientName: '',
}

export default function TicketsPage() {
  const router = useRouter()
  const qc = useQueryClient()

  const [statusFilter,   setStatusFilter]   = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchInput,    setSearchInput]    = useState('')
  const [search,         setSearch]         = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])
  const [form, setForm] = useState<TicketFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const { data: supportLinkData } = useQuery({
    queryKey: ['support-link'],
    queryFn: async () => {
      const res = await fetch('/api/settings/support-link')
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 60 * 60 * 1000,
  })

  const copySupportLink = () => {
    const token = supportLinkData?.data?.token
    if (!token) return
    const url = `${window.location.origin}/soporte/${token}`
    navigator.clipboard.writeText(url)
    toast.success('Link de soporte copiado')
  }

  const { data: empresasData } = useQuery({
    queryKey: ['empresas-tickets'],
    queryFn: async () => {
      const res = await fetch('/api/empresas/options')
      if (!res.ok) return { data: [] }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
  const empresaOptions = [
    { value: '', label: 'Sin empresa' },
    ...((empresasData?.data ?? []) as Array<{ id: string; name: string }>).map(e => ({ value: e.id, label: e.name })),
  ]

  const { data, isLoading } = useQuery<Ticket[]>({
    queryKey: ['tickets', statusFilter, categoryFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter)       params.set('status',   statusFilter)
      if (categoryFilter)     params.set('category', categoryFilter)
      if (search.length >= 2) params.set('search',   search)
      const res = await fetch(`/api/tickets?${params}`)
      if (!res.ok) throw new Error('Error al cargar tickets')
      return res.json().then(j => j.data)
    },
    staleTime: 30 * 1000,
  })

  const tickets = data ?? []

  // Estadísticas de la tira superior — consulta propia SIN filtros, para que
  // los números de arriba se mantengan como referencia fija mientras se
  // filtra la lista de abajo (si usaran `tickets`, filtrar por "Cerrado"
  // haría que "Abiertos" muestre 0 — confuso, no es lo que espera ver quien
  // está mirando el panorama general).
  const { data: allTicketsData } = useQuery<Ticket[]>({
    queryKey: ['tickets-stats'],
    queryFn: async () => {
      const res = await fetch('/api/tickets')
      if (!res.ok) return []
      return res.json().then(j => j.data)
    },
    staleTime: 30 * 1000,
  })
  const allTickets   = allTicketsData ?? []
  const openCount    = allTickets.filter(t => t.status === 'ABIERTO' || t.status === 'EN_PROCESO').length
  const overdueCount = allTickets.filter(isTicketOverdue).length
  const waitingCount = allTickets.filter(t => t.status === 'ESPERANDO').length
  const resolvedCount = allTickets.filter(t => t.status === 'RESUELTO' || t.status === 'CERRADO').length

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('El título es requerido'); return }
    if (!form.description.trim()) { toast.error('La descripción es requerida'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, empresaId: form.empresaId || undefined }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success(`Ticket #${json.data.number} creado`)
      setForm(EMPTY_FORM)
      setShowForm(false)
      qc.invalidateQueries({ queryKey: ['tickets'] })
      qc.invalidateQueries({ queryKey: ['tickets-stats'] })
    } catch { toast.error('Error') } finally { setSaving(false) }
  }

  const hasFilters = !!(statusFilter || categoryFilter || search)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Tickets de Soporte</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            Seguimiento de cada reclamo y consulta, con SLA y responsable asignado
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" leftIcon={<Link2 size={15} />} onClick={copySupportLink} title="Copiar el link para que un cliente abra su propio ticket">
            Link de soporte
          </Button>
          <Button leftIcon={<Plus size={16} />} onClick={() => setShowForm(true)}>
            Nuevo Ticket
          </Button>
        </div>
      </div>

      {/* Tira de estadísticas — panorama fijo, no cambia con los filtros de
          abajo (ver comentario en la query ['tickets-stats']). */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Abiertos',   value: openCount,     color: '#ef4444', icon: AlertCircle },
          { label: 'Vencidos',   value: overdueCount,  color: '#f59e0b', icon: TimerReset },
          { label: 'Esperando cliente', value: waitingCount, color: '#3b82f6', icon: Clock },
          { label: 'Resueltos',  value: resolvedCount, color: '#10b981', icon: CheckCircle2 },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${s.color}1A`, color: s.color }}>
              <s.icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold leading-tight" style={{ color: 'var(--color-text)' }}>{s.value}</p>
              <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)] pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar tickets..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="pl-8 pr-3 py-2 text-sm rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 w-44"
          />
        </div>
        <Select options={STATUS_OPTIONS} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-40" />
        <Select options={CATEGORY_OPTIONS} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-40" />
        {hasFilters && (
          <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
            {tickets.length} resultado{tickets.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Ticket list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[74px] rounded-2xl" />)}
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: 'rgba(99,102,241,0.1)' }}>
            <Inbox size={26} style={{ color: 'var(--color-primary)' }} />
          </div>
          <p className="font-medium" style={{ color: 'var(--color-text)' }}>
            {hasFilters ? 'No hay tickets con estos filtros' : 'Todavía no hay tickets'}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {hasFilters ? 'Probá cambiar o limpiar los filtros de arriba.' : 'Cuando alguien abra un reclamo o consulta, va a aparecer acá.'}
          </p>
          <Button className="mt-4" leftIcon={<Plus size={14} />} onClick={() => setShowForm(true)}>
            Crear primer ticket
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {tickets.map((ticket) => {
              const meta = STATUS_META[ticket.status]
              const overdue = isTicketOverdue(ticket)
              return (
                <motion.div
                  key={ticket.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2 }}
                  className="relative rounded-2xl overflow-hidden cursor-pointer transition-shadow hover:shadow-lg"
                  style={{ background: 'var(--color-surface)', border: `1px solid ${overdue ? 'rgba(239,68,68,0.35)' : 'var(--color-border)'}` }}
                  onClick={() => router.push(`/tickets/${ticket.id}`)}
                >
                  {/* Acento de color por estado */}
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: meta.color }} />

                  <div className="pl-5 pr-4 py-3.5 flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${meta.color}1A`, color: meta.color }}>
                      <meta.icon size={18} className={ticket.status === 'EN_PROCESO' ? 'animate-spin' : ''} style={ticket.status === 'EN_PROCESO' ? { animationDuration: '2.5s' } : undefined} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-xs font-mono" style={{ color: 'var(--color-text-subtle)' }}>
                          #{String(ticket.number).padStart(4, '0')}
                        </span>
                        <span className="font-semibold text-sm truncate" style={{ color: 'var(--color-text)' }}>{ticket.title}</span>
                        <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: `${meta.color}1A`, color: meta.color }}>
                          {meta.label}
                        </span>
                        {overdue && (
                          <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0"
                            style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#ef4444' }} />
                            SLA vencido
                          </span>
                        )}
                      </div>

                      <p className="text-xs line-clamp-1 mt-0.5" style={{ color: 'var(--color-text-subtle)' }}>{ticket.description}</p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                        <span className="text-[10.5px] font-medium px-1.5 py-0.5 rounded" style={{ background: `${PRIORITY_HEX[ticket.priority]}14`, color: PRIORITY_HEX[ticket.priority] }}>
                          {PRIORITY_LABELS[ticket.priority]}
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>{CATEGORY_LABELS[ticket.category]}</span>
                        {(ticket.empresa || ticket.client) && (
                          <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--color-text-subtle)' }}>
                            <Building2 size={10} />{ticket.empresa?.name ?? ticket.client?.name}
                          </span>
                        )}
                        <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--color-text-subtle)' }}>
                          <Clock size={10} />{timeAgo(ticket.createdAt)}
                        </span>
                        {ticket._count && ticket._count.messages > 0 && (
                          <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--color-text-subtle)' }}>
                            <MessageSquare size={10} />{ticket._count.messages}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {ticket.assignedTo ? (
                        <div title={`Asignado a ${ticket.assignedTo.name}`}>
                          <Avatar name={ticket.assignedTo.name} size="sm" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-subtle)' }} title="Sin asignar">
                          <User size={13} />
                        </div>
                      )}
                      <ChevronRight size={16} style={{ color: 'var(--color-text-subtle)' }} />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Create ticket modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nuevo Ticket" size="sm">
        <form onSubmit={handleCreate} className="space-y-3">
          <Input
            label="Título *"
            placeholder="Breve descripción del problema"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-muted)]">Descripción *</label>
            <textarea
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
              rows={3}
              placeholder="Descripción detallada del problema o consulta..."
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
            <Select
              label="Categoría"
              options={CATEGORY_OPTIONS.slice(1)}
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value as TicketCategory }))}
            />
          </div>
          <Select
            label="Empresa (opcional)"
            options={empresaOptions}
            value={form.empresaId}
            onChange={e => setForm(f => ({ ...f, empresaId: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Email de contacto (opcional)"
              type="email"
              placeholder="Para notificarle avances"
              value={form.recipientEmail}
              onChange={e => setForm(f => ({ ...f, recipientEmail: e.target.value }))}
            />
            <Input
              label="Nombre del contacto"
              value={form.recipientName}
              onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Abrir Ticket</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
