'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Send, Lock, Unlock, User, Clock, Tag, AlertCircle,
  CheckCircle, XCircle, Edit2, ChevronDown, Paperclip, X, FileText, Image as ImageIcon, ListPlus, Star,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Avatar } from '@/components/ui/avatar'
import { AvatarStack } from '@/components/ui/avatar-stack'
import { UserMultiSelect } from '@/components/ui/user-multi-select'
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
  const [isInternal, setIsInternal] = useState(true)
  const [sending, setSending] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [attachment, setAttachment] = useState<{ url: string; name: string } | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [creatingFollowUp, setCreatingFollowUp] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sin refetchInterval a propósito — esta era la única pantalla de toda la
  // app que hacía polling. Refetcheaba el ticket ENTERO (incluido el hilo de
  // mensajes completo, sin paginar) cada 30s aunque nadie hubiera escrito
  // nada, mientras la pestaña estuviera abierta — un costo que se repetía
  // indefinidamente y compuesto con el resto de la investigación de
  // performance (cada refetch vuelve a pagar la resolución de sesión +
  // esta query). staleTime ya alcanza para refrescar solo al reabrir/
  // refocus la pestaña, mismo criterio que el resto de la app; las acciones
  // que sí cambian el ticket (enviar mensaje, cambiar estado) ya invalidan
  // esta queryKey explícitamente.
  const { data, isLoading } = useQuery<TicketDetail>({
    queryKey: ['ticket', id],
    queryFn: async () => {
      const res = await fetch(`/api/tickets/${id}`)
      if (!res.ok) throw new Error('Ticket no encontrado')
      return res.json().then(j => j.data)
    },
    staleTime: 30 * 1000,
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
        body: JSON.stringify({
          content: message.trim(),
          isInternal,
          attachmentUrl:  attachment?.url  ?? null,
          attachmentName: attachment?.name ?? null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      setMessage('')
      setAttachment(null)
      if (!isInternal) {
        if (json.emailNotified) toast.success('Nota guardada y cliente notificado por email')
        else if (json.emailError) toast(json.emailError, { icon: '⚠️' })
      }
      qc.invalidateQueries({ queryKey: ['ticket', id] })
      qc.invalidateQueries({ queryKey: ['tickets'] })
    } catch { toast.error('Error') } finally { setSending(false) }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/tickets/${id}/upload`, { method: 'POST', body: formData })
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

  const handleUpdate = async (field: Partial<{ status: string; priority: string; category: string; assignedToId: string | null; recipientEmail: string | null; collaboratorIds: string[] }>) => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(field),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      qc.invalidateQueries({ queryKey: ['ticket', id] })
      qc.invalidateQueries({ queryKey: ['tickets'] })
      if (field.status === 'RESUELTO' || field.status === 'CERRADO') {
        toast.success(json.satisfactionEmailSent
          ? 'Ticket actualizado — se invitó al cliente a calificar la atención'
          : 'Ticket actualizado')
      } else {
        toast.success('Ticket actualizado')
      }
    } catch { toast.error('Error') } finally { setUpdating(false) }
  }

  const handleCreateFollowUp = async () => {
    if (!data) return
    setCreatingFollowUp(true)
    try {
      const res = await fetch('/api/tareas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Seguimiento — Ticket #${String(data.number).padStart(4, '0')}: ${data.title}`,
          description: `Tarea de seguimiento generada desde el ticket #${String(data.number).padStart(4, '0')}.`,
          assignedToId: data.assignedToId || undefined,
          empresaId: data.empresaId || undefined,
          clientId: data.clientId || undefined,
          ticketId: data.id,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al crear la tarea'); return }
      toast.success((t) => (
        <span>
          Tarea creada — <Link href="/tareas" className="underline" onClick={() => toast.dismiss(t.id)}>ver en Tareas</Link>
        </span>
      ))
    } catch {
      toast.error('Error de conexión')
    } finally {
      setCreatingFollowUp(false)
    }
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
  const isOverdue = !!data.slaDueAt && !isClosed && new Date(data.slaDueAt).getTime() < Date.now()
  const isImageFile = (name?: string | null) => !!name && /\.(png|jpe?g|webp)$/i.test(name)

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
          {isOverdue && (
            <Badge variant="danger" size="sm">
              <AlertCircle size={9} className="mr-1" />SLA vencido
            </Badge>
          )}
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
                  {msg.attachmentUrl && (
                    isImageFile(msg.attachmentName) ? (
                      <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block mt-2.5 max-w-[240px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={msg.attachmentUrl} alt={msg.attachmentName ?? 'adjunto'} className="rounded-xl border border-[var(--color-border)] max-h-56 object-cover" />
                      </a>
                    ) : (
                      <a
                        href={msg.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2.5 inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/40 transition-colors"
                      >
                        <FileText size={13} />
                        {msg.attachmentName ?? 'Archivo adjunto'}
                      </a>
                    )
                  )}
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
                  Agregar actualización o nota
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
                  {isInternal ? 'Solo equipo' : 'Público (notifica al cliente)'}
                </button>
              </div>
              <textarea
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                rows={3}
                placeholder="Descripción del avance, diagnóstico, acción tomada..."
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
              {attachment && (
                <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-[var(--color-surface-raised)] w-fit">
                  {isImageFile(attachment.name) ? <ImageIcon size={13} /> : <FileText size={13} />}
                  <span className="text-[var(--color-text-muted)] max-w-[180px] truncate">{attachment.name}</span>
                  <button type="button" onClick={() => setAttachment(null)} className="text-[var(--color-text-subtle)] hover:text-red-400">
                    <X size={12} />
                  </button>
                </div>
              )}
              <div className="flex justify-between items-center">
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFileSelect} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile || !!attachment}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors disabled:opacity-50"
                >
                  <Paperclip size={13} />
                  {uploadingFile ? 'Subiendo...' : 'Adjuntar foto o PDF'}
                </button>
                <Button type="submit" loading={sending} leftIcon={<Send size={14} />}>
                  Guardar Nota
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
                {user?.role !== 'TECHNICIAN' ? (
                  <Select
                    options={PRIORITY_OPTIONS}
                    value={data.priority}
                    onChange={e => handleUpdate({ priority: e.target.value })}
                    disabled={updating}
                  />
                ) : (
                  <p className="text-sm text-[var(--color-text)]">{PRIORITY_OPTIONS.find(o => o.value === data.priority)?.label ?? data.priority}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-subtle)] mb-1">Categoría</p>
                {user?.role !== 'TECHNICIAN' ? (
                  <Select
                    options={CATEGORY_OPTIONS}
                    value={data.category}
                    onChange={e => handleUpdate({ category: e.target.value })}
                    disabled={updating}
                  />
                ) : (
                  <p className="text-sm text-[var(--color-text)]">{CATEGORY_OPTIONS.find(o => o.value === data.category)?.label ?? data.category}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-subtle)] mb-1">Asignado a</p>
                {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') ? (
                  <Select
                    options={[
                      { value: '', label: 'Sin asignar' },
                      ...users.map(u => ({ value: u.id, label: u.name })),
                    ]}
                    value={data.assignedToId ?? ''}
                    onChange={e => handleUpdate({ assignedToId: e.target.value || null })}
                    disabled={updating}
                  />
                ) : (
                  <p className="text-sm text-[var(--color-text)]">{data.assignedTo?.name ?? 'Sin asignar'}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-subtle)] mb-1">Colaboradores</p>
                {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') ? (
                  <UserMultiSelect
                    users={users}
                    selectedIds={(data.collaborators ?? []).map(c => c.user.id)}
                    onChange={ids => handleUpdate({ collaboratorIds: ids })}
                    excludeId={data.assignedToId}
                  />
                ) : (data.collaborators?.length ?? 0) > 0 ? (
                  <AvatarStack size="xs" people={(data.collaborators ?? []).map(c => c.user)} />
                ) : (
                  <p className="text-sm" style={{ color: 'var(--color-text-subtle)' }}>Nadie más</p>
                )}
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-subtle)] mb-1">Email de contacto</p>
                {user?.role !== 'TECHNICIAN' ? (
                  <input
                    key={data.recipientEmail ?? ''}
                    type="email"
                    defaultValue={data.recipientEmail ?? ''}
                    placeholder="Para notificarle avances"
                    disabled={updating}
                    onBlur={e => { if (e.target.value !== (data.recipientEmail ?? '')) handleUpdate({ recipientEmail: e.target.value || null }) }}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                  />
                ) : (
                  <p className="text-sm text-[var(--color-text)]">{data.recipientEmail ?? 'Sin cargar'}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCreateFollowUp}
              disabled={creatingFollowUp}
              className="w-full flex items-center justify-center gap-1.5 text-xs px-2.5 py-2 rounded-lg border border-dashed border-[var(--color-border-strong)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/40 transition-colors disabled:opacity-50"
            >
              <ListPlus size={13} />
              {creatingFollowUp ? 'Creando...' : 'Crear tarea de seguimiento'}
            </button>
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
            {data.slaDueAt && !isClosed && (
              <div className="flex items-center gap-2">
                <AlertCircle size={13} className={isOverdue ? 'text-red-400 shrink-0' : 'text-[var(--color-text-subtle)] shrink-0'} />
                <div>
                  <p className="text-xs text-[var(--color-text-subtle)]">SLA</p>
                  <p className={`text-sm ${isOverdue ? 'text-red-400 font-medium' : 'text-[var(--color-text)]'}`}>
                    {isOverdue ? `Vencido — ${formatDate(data.slaDueAt)}` : `Vence ${formatDate(data.slaDueAt)}`}
                  </p>
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

          {/* CSAT */}
          {isClosed && (
            <div className="surface rounded-2xl p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">Satisfacción del cliente</p>
              {data.satisfactionRating ? (
                <>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        size={16}
                        fill={data.satisfactionRating! >= n ? '#f59e0b' : 'none'}
                        color={data.satisfactionRating! >= n ? '#f59e0b' : 'var(--color-border-strong)'}
                        strokeWidth={1.5}
                      />
                    ))}
                  </div>
                  {data.satisfactionComment && (
                    <p className="text-sm text-[var(--color-text-muted)] italic">&ldquo;{data.satisfactionComment}&rdquo;</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-[var(--color-text-subtle)]">
                  {data.recipientEmail || data.client
                    ? 'Esperando que el cliente califique la atención.'
                    : 'Sin email de contacto cargado, no se pudo invitar a calificar.'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
