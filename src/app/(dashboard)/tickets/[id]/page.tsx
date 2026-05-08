'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Send, Lock, Unlock, User, Clock, Tag, AlertCircle,
  CheckCircle, XCircle, Edit2, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import type { Ticket, TicketMessage, TaskPriority, TicketStatus, TicketCategory } from '@/types'
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
  { value: 'ABIERTO',     label: 'Abierto' },
  { value: 'EN_PROCESO',  label: 'En proceso' },
  { value: 'ESPERANDO',   label: 'Esperando cliente' },
  { value: 'RESUELTO',    label: 'Resuelto' },
  { value: 'CERRADO',     label: 'Cerrado' },
]

const PRIORITY_OPTIONS = [
  { value: 'BAJA',    label: 'Baja' },
  { value: 'MEDIA',   label: 'Media' },
  { value: 'ALTA',    label: 'Alta' },
  { value: 'URGENTE', label: 'Urgente' },
]

const CATEGORY_OPTIONS = [
  { value: 'SOPORTE',     label: 'Soporte técnico' },
  { value: 'BUG',         label: 'Bug / Error' },
  { value: 'FACTURACION', label: 'Facturación' },
  { value: 'CONSULTA',    label: 'Consulta' },
]

interface TicketDetail extends Ticket {
  messages: (TicketMessage & { user: { id: string; name: string; avatarUrl: string | null } })[]
  createdBy: { id: string; name: string }
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [message, setMessage] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [sending, setSending] = useState(false)
  const [updating, setUpdating] = useState(false)

  const { data, isLoading } = useQuery<TicketDetail>({
    queryKey: ['ticket', id],
    queryFn: async () => {
      const res = await fetch(`/api/tickets/${id}`)
      if (!res.ok) throw new Error('Ticket no encontrado')
      return res.json().then(j => j.data)
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  })

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

  useEffect(() => {
    if (data?.messages?.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [data?.messages?.length])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/tickets/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message.trim(), isInternal }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      setMessage('')
      qc.invalidateQueries({ queryKey: ['ticket', id] })
      qc.invalidateQueries({ queryKey: ['tickets'] })
    } catch { toast.error('Error') } finally { setSending(false) }
  }

  const handleUpdate = async (field: Partial<{ status: string; priority: string; category: string; assignedToId: string | null }>) => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(field),
      })
      if (!res.ok) { const j = await res.json(); toast.error(j.error); return }
      qc.invalidateQueries({ queryKey: ['ticket', id] })
      qc.invalidateQueries({ queryKey: ['tickets'] })
      toast.success('Ticket actualizado')
    } catch { toast.error('Error') } finally { setUpdating(false) }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2"><Skeleton className="h-96 rounded-2xl" /></div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!data) return null

  const isClosed = data.status === 'RESUELTO' || data.status === 'CERRADO'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/tickets')}
          className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Tickets</span>
        </button>
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <span className="text-xs font-mono text-[var(--color-text-subtle)]">
            #{String(data.number).padStart(4, '0')}
          </span>
          <h1 className="text-lg font-bold text-[var(--color-text)]">{data.title}</h1>
          <Badge variant={STATUS_COLORS[data.status] as 'danger' | 'warning' | 'info' | 'success' | 'neutral'} dot>
            {data.status.replace('_', ' ')}
          </Badge>
          <Badge variant={PRIORITY_COLORS[data.priority] as 'neutral' | 'info' | 'warning' | 'danger'} size="sm">
            {data.priority}
          </Badge>
          <Badge variant="neutral" size="sm">{data.category}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Message thread */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {/* Description card */}
          <div className="surface rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Avatar name={data.createdBy?.name ?? 'S'} size="xs" />
              <span className="text-sm font-medium text-[var(--color-text)]">{data.createdBy?.name ?? 'Sistema'}</span>
              <span className="text-xs text-[var(--color-text-subtle)]">{timeAgo(data.createdAt)}</span>
              <Badge variant="neutral" size="sm">Apertura</Badge>
            </div>
            <p className="text-sm text-[var(--color-text-muted)] whitespace-pre-wrap">{data.description}</p>
          </div>

          {/* Messages */}
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {data.messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`surface rounded-xl p-3.5 ${msg.isInternal ? 'border-l-2 border-amber-400/60 bg-amber-500/5' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Avatar name={msg.user.name} src={msg.user.avatarUrl ?? undefined} size="xs" />
                    <span className="text-sm font-medium text-[var(--color-text)]">{msg.user.name}</span>
                    <span className="text-xs text-[var(--color-text-subtle)]">{timeAgo(msg.createdAt)}</span>
                    {msg.isInternal && (
                      <Badge variant="warning" size="sm">
                        <Lock size={8} className="mr-1" />Nota interna
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)] whitespace-pre-wrap">{msg.content}</p>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Reply form */}
          {!isClosed ? (
            <form onSubmit={handleSend} className="surface rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--color-text)]">
                  {isInternal ? 'Nota interna' : 'Responder al cliente'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsInternal(v => !v)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    isInternal
                      ? 'border-amber-400/40 bg-amber-500/10 text-amber-400'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  {isInternal ? <Lock size={11} /> : <Unlock size={11} />}
                  {isInternal ? 'Nota interna' : 'Público'}
                </button>
              </div>
              <textarea
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                rows={3}
                placeholder={isInternal ? 'Nota solo visible para el equipo...' : 'Escribe tu respuesta...'}
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
              <div className="flex justify-end">
                <Button type="submit" loading={sending} leftIcon={<Send size={14} />}>
                  {isInternal ? 'Guardar nota' : 'Enviar respuesta'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="surface rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <CheckCircle size={14} className="text-emerald-400" />
              Ticket {data.status.toLowerCase()}. Cambia el estado para reabrir.
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {/* Status & actions */}
          <div className="surface rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">Gestión</p>
            <div className="space-y-2.5">
              <div>
                <p className="text-xs text-[var(--color-text-subtle)] mb-1">Estado</p>
                <Select
                  options={STATUS_OPTIONS}
                  value={data.status}
                  onChange={e => handleUpdate({ status: e.target.value })}
                  disabled={updating}
                />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-subtle)] mb-1">Prioridad</p>
                <Select
                  options={PRIORITY_OPTIONS}
                  value={data.priority}
                  onChange={e => handleUpdate({ priority: e.target.value })}
                  disabled={updating}
                />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-subtle)] mb-1">Categoría</p>
                <Select
                  options={CATEGORY_OPTIONS}
                  value={data.category}
                  onChange={e => handleUpdate({ category: e.target.value })}
                  disabled={updating}
                />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-subtle)] mb-1">Asignado a</p>
                <Select
                  options={[
                    { value: '', label: 'Sin asignar' },
                    ...users.map(u => ({ value: u.id, label: u.name })),
                  ]}
                  value={data.assignedToId ?? ''}
                  onChange={e => handleUpdate({ assignedToId: e.target.value || null })}
                  disabled={updating}
                />
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="surface rounded-2xl p-4 space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">Detalles</p>
            {data.client && (
              <div className="flex items-center gap-2">
                <User size={13} className="text-[var(--color-text-subtle)] shrink-0" />
                <div>
                  <p className="text-xs text-[var(--color-text-subtle)]">Cliente</p>
                  <p className="text-sm text-[var(--color-text)]">{data.client.name}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-[var(--color-text-subtle)] shrink-0" />
              <div>
                <p className="text-xs text-[var(--color-text-subtle)]">Creado</p>
                <p className="text-sm text-[var(--color-text)]">{formatDate(data.createdAt)}</p>
              </div>
            </div>
            {data.resolvedAt && (
              <div className="flex items-center gap-2">
                <CheckCircle size={13} className="text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs text-[var(--color-text-subtle)]">Resuelto</p>
                  <p className="text-sm text-[var(--color-text)]">{formatDate(data.resolvedAt)}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Tag size={13} className="text-[var(--color-text-subtle)] shrink-0" />
              <div>
                <p className="text-xs text-[var(--color-text-subtle)]">Mensajes</p>
                <p className="text-sm text-[var(--color-text)]">{data.messages.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
