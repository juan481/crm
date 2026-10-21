'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Send, Lock, Unlock, Clock, AlertCircle,
  CheckCircle, Paperclip, X, FileText, Image as ImageIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Avatar } from '@/components/ui/avatar'
import { AvatarStack } from '@/components/ui/avatar-stack'
import { UserMultiSelect } from '@/components/ui/user-multi-select'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo, formatDate } from '@/lib/utils'
import type { Ticket, TicketMessage, TaskPriority, TicketStatus } from '@/types'
import toast from 'react-hot-toast'

// Detalle de ticket del portal de soporte externo — mismas acciones que
// (dashboard)/tickets/[id]/page.tsx para estado/asignación/colaboradores/
// mensajes, pero sin editar título/prioridad/categoría/empresa/contacto
// (eso lo sigue manejando el staff interno) y sin "crear tarea de
// seguimiento" (módulo de Tareas, fuera del alcance de este portal).
const STATUS_COLORS: Record<TicketStatus, string> = {
  ABIERTO: 'danger', EN_PROCESO: 'warning', ESPERANDO: 'info', RESUELTO: 'success', CERRADO: 'neutral',
}
const PRIORITY_COLORS: Record<TaskPriority, string> = {
  BAJA: 'neutral', MEDIA: 'info', ALTA: 'warning', URGENTE: 'danger',
}
const STATUS_OPTIONS = [
  { value: 'ABIERTO', label: 'Abierto' },
  { value: 'EN_PROCESO', label: 'En proceso' },
  { value: 'ESPERANDO', label: 'Esperando cliente' },
  { value: 'RESUELTO', label: 'Resuelto' },
  { value: 'CERRADO', label: 'Cerrado' },
]

interface TicketDetail extends Ticket {
  messages: (TicketMessage & { user: { id: string; name: string; avatarUrl: string | null } })[]
  createdBy: { id: string; name: string }
}

export default function SoporteExternoTicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [message, setMessage] = useState('')
  const [isInternal, setIsInternal] = useState(true)
  const [sending, setSending] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [attachment, setAttachment] = useState<{ url: string; name: string } | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useQuery<TicketDetail>({
    queryKey: ['soporte-externo-ticket', id],
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
    if (data?.messages?.length) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [data?.messages?.length])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/tickets/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message.trim(), isInternal, attachmentUrl: attachment?.url ?? null, attachmentName: attachment?.name ?? null }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      setMessage('')
      setAttachment(null)
      if (!isInternal) {
        if (json.emailNotified) toast.success('Nota guardada y cliente notificado por email')
        else if (json.emailError) toast(json.emailError, { icon: '⚠️' })
      }
      qc.invalidateQueries({ queryKey: ['soporte-externo-ticket', id] })
      qc.invalidateQueries({ queryKey: ['soporte-externo-tickets'] })
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
    } catch { toast.error('Error de conexión') } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleUpdate = async (field: Partial<{ status: string; assignedToId: string | null; collaboratorIds: string[] }>) => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(field),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      qc.invalidateQueries({ queryKey: ['soporte-externo-ticket', id] })
      qc.invalidateQueries({ queryKey: ['soporte-externo-tickets'] })
      toast.success(field.status && (field.status === 'RESUELTO' || field.status === 'CERRADO') && json.satisfactionEmailSent
        ? 'Ticket actualizado — se invitó al cliente a calificar la atención'
        : 'Ticket actualizado')
    } catch { toast.error('Error') } finally { setUpdating(false) }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }
  if (!data) return null

  const isClosed = data.status === 'RESUELTO' || data.status === 'CERRADO'
  const isOverdue = !!data.slaDueAt && !isClosed && new Date(data.slaDueAt).getTime() < Date.now()
  const isImageFile = (name?: string | null) => !!name && /\.(png|jpe?g|webp)$/i.test(name)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/soporte-externo/tickets')} className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
          <ArrowLeft size={18} />
          <span className="text-sm">Tickets</span>
        </button>
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <span className="text-xs font-mono text-[var(--color-text-subtle)]">#{String(data.number).padStart(4, '0')}</span>
          <h1 className="text-lg font-bold text-[var(--color-text)]">{data.title}</h1>
          <Badge variant={STATUS_COLORS[data.status] as 'danger' | 'warning' | 'info' | 'success' | 'neutral'} dot>
            {data.status.replace('_', ' ')}
          </Badge>
          <Badge variant={PRIORITY_COLORS[data.priority] as 'neutral' | 'info' | 'warning' | 'danger'} size="sm">{data.priority}</Badge>
          {isOverdue && <Badge variant="danger" size="sm"><AlertCircle size={9} className="mr-1" />SLA vencido</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 flex flex-col gap-3">
          <div className="surface rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Avatar name={data.createdBy?.name ?? 'S'} size="xs" />
              <span className="text-sm font-medium text-[var(--color-text)]">{data.createdBy?.name ?? 'Sistema'}</span>
              <span className="text-xs text-[var(--color-text-subtle)]">{timeAgo(data.createdAt)}</span>
              <Badge variant="neutral" size="sm">Apertura</Badge>
            </div>
            <p className="text-sm text-[var(--color-text-muted)] whitespace-pre-wrap">{data.description}</p>
          </div>

          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {data.messages.map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={`surface rounded-xl p-3.5 ${msg.isInternal ? 'border-l-2 border-amber-400/60 bg-amber-500/5' : ''}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Avatar name={msg.user.name} src={msg.user.avatarUrl ?? undefined} size="xs" />
                    <span className="text-sm font-medium text-[var(--color-text)]">{msg.user.name}</span>
                    <span className="text-xs text-[var(--color-text-subtle)]">{timeAgo(msg.createdAt)}</span>
                    {msg.isInternal && <Badge variant="warning" size="sm"><Lock size={8} className="mr-1" />Nota interna</Badge>}
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)] whitespace-pre-wrap">{msg.content}</p>
                  {msg.attachmentUrl && (
                    isImageFile(msg.attachmentName) ? (
                      <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block mt-2.5 max-w-[240px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={msg.attachmentUrl} alt={msg.attachmentName ?? 'adjunto'} className="rounded-xl border border-[var(--color-border)] max-h-56 object-cover" />
                      </a>
                    ) : (
                      <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer"
                        className="mt-2.5 inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/40 transition-colors">
                        <FileText size={13} />{msg.attachmentName ?? 'Archivo adjunto'}
                      </a>
                    )
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {!isClosed ? (
            <form onSubmit={handleSend} className="surface rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--color-text)]">Agregar actualización o nota</span>
                <button type="button" onClick={() => setIsInternal(v => !v)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${isInternal ? 'border-amber-400/40 bg-amber-500/10 text-amber-400' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}>
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
                  <button type="button" onClick={() => setAttachment(null)} className="text-[var(--color-text-subtle)] hover:text-red-400"><X size={12} /></button>
                </div>
              )}
              <div className="flex justify-between items-center">
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFileSelect} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile || !!attachment}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors disabled:opacity-50">
                  <Paperclip size={13} />{uploadingFile ? 'Subiendo...' : 'Adjuntar foto o PDF'}
                </button>
                <Button type="submit" loading={sending} leftIcon={<Send size={14} />}>Guardar Nota</Button>
              </div>
            </form>
          ) : (
            <div className="surface rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <CheckCircle size={14} className="text-emerald-400" />
              Ticket {data.status.toLowerCase()}. Cambiá el estado para reabrir.
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="surface rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">Gestión</p>
            <div className="space-y-2.5">
              <div>
                <p className="text-xs text-[var(--color-text-subtle)] mb-1">Estado</p>
                <Select options={STATUS_OPTIONS} value={data.status} onChange={e => handleUpdate({ status: e.target.value })} disabled={updating} />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-subtle)] mb-1">Asignado a</p>
                <Select
                  options={[{ value: '', label: 'Sin asignar' }, ...users.map(u => ({ value: u.id, label: u.name }))]}
                  value={data.assignedToId ?? ''}
                  onChange={e => handleUpdate({ assignedToId: e.target.value || null })}
                  disabled={updating}
                />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-subtle)] mb-1">Colaboradores</p>
                <UserMultiSelect
                  users={users}
                  selectedIds={(data.collaborators ?? []).map(c => c.user.id)}
                  onChange={ids => handleUpdate({ collaboratorIds: ids })}
                  excludeId={data.assignedToId}
                />
              </div>
            </div>
          </div>

          <div className="surface rounded-2xl p-4 space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">Detalles</p>
            {(data.empresa || data.client) && (
              <div className="flex items-center gap-2">
                <AvatarStack size="xs" people={[{ id: 'e', name: (data.empresa?.name ?? data.client?.name) as string, avatarUrl: null }]} />
                <div>
                  <p className="text-xs text-[var(--color-text-subtle)]">Empresa / Cliente</p>
                  <p className="text-sm text-[var(--color-text)]">{data.empresa?.name ?? data.client?.name}</p>
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
          </div>
        </div>
      </div>
    </div>
  )
}
