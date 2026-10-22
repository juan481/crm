'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, User, Clock, AlertCircle, Building2, Search,
  CheckCircle2, Loader2, Archive, ChevronRight, Inbox, TimerReset,
} from 'lucide-react'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { AvatarStack } from '@/components/ui/avatar-stack'
import { timeAgo } from '@/lib/utils'
import type { Ticket, TaskPriority, TicketStatus } from '@/types'

// Listado de tickets del portal de soporte externo — mismo diseño visual
// que (dashboard)/tickets/page.tsx, pero sin "Nuevo ticket" ni "Link de
// soporte" (ese flujo lo sigue manejando el staff interno). Ve TODOS los
// tickets (no sólo los asignados a él/ella), que es justo el pedido de
// Abba: supervisar y derivar, no un buzón personal.
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

export default function SoporteExternoTicketsPage() {
  const router = useRouter()

  const [statusFilter, setStatusFilter] = useState('')
  const [searchInput,  setSearchInput]  = useState('')
  const [search,       setSearch]       = useState('')

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data, isLoading } = useQuery<Ticket[]>({
    queryKey: ['soporte-externo-tickets', statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter)       params.set('status', statusFilter)
      if (search.length >= 2) params.set('search', search)
      const res = await fetch(`/api/tickets?${params}`)
      if (!res.ok) throw new Error('Error al cargar tickets')
      return res.json().then(j => j.data)
    },
    staleTime: 30 * 1000,
  })

  const tickets = data ?? []

  const { data: allTicketsData } = useQuery<Ticket[]>({
    queryKey: ['soporte-externo-tickets-stats'],
    queryFn: async () => {
      const res = await fetch('/api/tickets')
      if (!res.ok) return []
      return res.json().then(j => j.data)
    },
    staleTime: 30 * 1000,
  })
  const allTickets    = allTicketsData ?? []
  const openCount     = allTickets.filter(t => t.status === 'ABIERTO' || t.status === 'EN_PROCESO').length
  const overdueCount  = allTickets.filter(isTicketOverdue).length
  const unassignedCount = allTickets.filter(t => !t.assignedTo).length

  const hasFilters = !!(statusFilter || search)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text)]">Tickets de Soporte</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Asigná, seguí el estado y respondé cada reclamo</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: 'Abiertos', value: openCount, color: '#ef4444', icon: AlertCircle },
          { label: 'Vencidos', value: overdueCount, color: '#f59e0b', icon: TimerReset },
          { label: 'Sin asignar', value: unassignedCount, color: '#64748b', icon: User },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-3 flex items-center gap-2.5"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${s.color}1A`, color: s.color }}>
              <s.icon size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight" style={{ color: 'var(--color-text)' }}>{s.value}</p>
              <p className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

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
        {hasFilters && (
          <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
            {tickets.length} resultado{tickets.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[74px] rounded-2xl" />)}
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(99,102,241,0.1)' }}>
            <Inbox size={26} style={{ color: 'var(--color-primary)' }} />
          </div>
          <p className="font-medium" style={{ color: 'var(--color-text)' }}>
            {hasFilters ? 'No hay tickets con estos filtros' : 'Todavía no hay tickets'}
          </p>
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
                  onClick={() => router.push(`/soporte-externo/tickets/${ticket.id}`)}
                >
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
                            SLA vencido
                          </span>
                        )}
                      </div>
                      <p className="text-xs line-clamp-1 mt-0.5" style={{ color: 'var(--color-text-subtle)' }}>{ticket.description}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                        <span className="text-[10.5px] font-medium px-1.5 py-0.5 rounded" style={{ background: `${PRIORITY_HEX[ticket.priority]}14`, color: PRIORITY_HEX[ticket.priority] }}>
                          {PRIORITY_LABELS[ticket.priority]}
                        </span>
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
                        <AvatarStack size="sm" people={[
                          { id: ticket.assignedTo.id, name: ticket.assignedTo.name, avatarUrl: ticket.assignedTo.avatarUrl },
                          ...(ticket.collaborators ?? []).map(c => c.user),
                        ]} />
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
    </div>
  )
}
