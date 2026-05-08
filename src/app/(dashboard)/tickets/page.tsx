'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, MessageSquare, User, Clock, AlertCircle, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo } from '@/lib/utils'
import type { Ticket, TaskPriority, TicketStatus, TicketCategory } from '@/types'
import toast from 'react-hot-toast'

const STATUS_COLORS: Record<TicketStatus, string> = {
  ABIERTO:    'danger',
  EN_PROCESO: 'warning',
  ESPERANDO:  'info',
  RESUELTO:   'success',
  CERRADO:    'neutral',
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  BAJA: 'neutral', MEDIA: 'info', ALTA: 'warning', URGENTE: 'danger',
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
  clientId: string
}

const EMPTY_FORM: TicketFormState = {
  title: '', description: '', priority: 'MEDIA', category: 'SOPORTE', clientId: '',
}

export default function TicketsPage() {
  const router = useRouter()
  const qc = useQueryClient()

  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<TicketFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

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

  const { data, isLoading } = useQuery<Ticket[]>({
    queryKey: ['tickets', statusFilter, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (categoryFilter) params.set('category', categoryFilter)
      const res = await fetch(`/api/tickets?${params}`)
      if (!res.ok) throw new Error('Error al cargar tickets')
      return res.json().then(j => j.data)
    },
    staleTime: 30 * 1000,
  })

  const tickets = data ?? []
  const openCount = tickets.filter(t => t.status === 'ABIERTO' || t.status === 'EN_PROCESO').length

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('El título es requerido'); return }
    if (!form.description.trim()) { toast.error('La descripción es requerida'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, clientId: form.clientId || undefined }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success(`Ticket #${json.data.number} creado`)
      setForm(EMPTY_FORM)
      setShowForm(false)
      qc.invalidateQueries({ queryKey: ['tickets'] })
    } catch { toast.error('Error') } finally { setSaving(false) }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Tickets de Soporte</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {openCount} ticket{openCount !== 1 ? 's' : ''} abierto{openCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select options={STATUS_OPTIONS} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-40" />
          <Select options={CATEGORY_OPTIONS} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-40" />
          <Button leftIcon={<Plus size={16} />} onClick={() => setShowForm(true)}>
            Nuevo Ticket
          </Button>
        </div>
      </div>

      {/* Ticket list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : tickets.length === 0 ? (
        <div className="surface rounded-2xl p-16 text-center">
          <MessageSquare className="mx-auto mb-3 text-[var(--color-text-subtle)]" size={40} />
          <p className="text-[var(--color-text-muted)]">No hay tickets{statusFilter || categoryFilter ? ' con estos filtros' : ' aún'}</p>
          <Button className="mt-4" leftIcon={<Plus size={14} />} onClick={() => setShowForm(true)}>
            Crear primer ticket
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {tickets.map((ticket) => (
              <motion.div
                key={ticket.id}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="surface rounded-xl px-4 py-3 flex items-start gap-4 cursor-pointer hover:border-[var(--color-border-strong)] transition-colors"
                onClick={() => router.push(`/tickets/${ticket.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-[var(--color-text-subtle)]">
                      #{String(ticket.number).padStart(4, '0')}
                    </span>
                    <span className="font-medium text-sm text-[var(--color-text)]">{ticket.title}</span>
                    <Badge variant={STATUS_COLORS[ticket.status] as 'danger' | 'warning' | 'info' | 'success' | 'neutral'} size="sm" dot>
                      {ticket.status.replace('_', ' ')}
                    </Badge>
                    <Badge variant={PRIORITY_COLORS[ticket.priority] as 'neutral' | 'info' | 'warning' | 'danger'} size="sm">
                      {ticket.priority}
                    </Badge>
                    <Badge variant="neutral" size="sm">{ticket.category}</Badge>
                  </div>
                  <p className="text-xs text-[var(--color-text-subtle)] line-clamp-1">{ticket.description}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                    {ticket.client && (
                      <span className="text-[10px] text-[var(--color-text-subtle)] flex items-center gap-1">
                        <User size={9} />{ticket.client.name}
                      </span>
                    )}
                    {ticket.assignedTo && (
                      <span className="text-[10px] text-[var(--color-text-subtle)] flex items-center gap-1">
                        <User size={9} />Asignado: {ticket.assignedTo.name}
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--color-text-subtle)] flex items-center gap-1">
                      <Clock size={9} />{timeAgo(ticket.createdAt)}
                    </span>
                    {ticket._count && ticket._count.messages > 0 && (
                      <span className="text-[10px] text-[var(--color-text-subtle)] flex items-center gap-1">
                        <MessageSquare size={9} />{ticket._count.messages} mensajes
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
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
            label="Cliente (opcional)"
            options={clientOptions}
            value={form.clientId}
            onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Abrir Ticket</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
