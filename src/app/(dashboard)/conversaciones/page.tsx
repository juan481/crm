'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Search, Send, Bot, User as UserIcon, ArrowLeft, Hand, RotateCcw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, timeAgo, formatDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'

interface ConvListItem {
  id: string
  customerPhone: string
  customerName: string | null
  status: 'ACTIVE' | 'HANDED_OFF' | 'CLOSED'
  humanHandling: boolean
  assignedUser: { id: string; name: string } | null
  handedOffTo: string | null
  ticketId: string | null
  dealId: string | null
  lastMessageAt: string
  unread: boolean
  preview: string
}

interface ConvThread {
  id: string
  customerPhone: string
  customerName: string | null
  status: string
  humanHandling: boolean
  assignedUser: { id: string; name: string } | null
  handedOffTo: string | null
  collectedData: Record<string, unknown> | null
  windowOpen: boolean
  windowExpiresAt: string | null
  deal: { id: string; title: string; stage: string } | null
  ticket: { id: string; number: number; title: string; status: string } | null
  contacto: { id: string; firstName: string; lastName: string } | null
  messages: { id: string; role: string; content: string; createdAt: string; author: string; fromHuman: boolean }[]
}

const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'nissi', label: 'NISSI' },
  { key: 'humano', label: 'Con humano' },
  { key: 'derivadas', label: 'Derivadas' },
  { key: 'cerradas', label: 'Cerradas' },
]

function estadoBadge(c: { status: string; humanHandling: boolean }) {
  if (c.humanHandling) return <Badge variant="warning" size="sm">Con humano</Badge>
  if (c.status === 'HANDED_OFF') return <Badge variant="info" size="sm">Derivada</Badge>
  if (c.status === 'CLOSED') return <Badge variant="neutral" size="sm">Cerrada</Badge>
  return <Badge variant="success" size="sm" dot>NISSI</Badge>
}

export default function ConversacionesPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get('c')

  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const listQuery = useQuery<{ data: ConvListItem[] }>({
    queryKey: ['conversaciones', filter, debouncedSearch],
    queryFn: async () => {
      const p = new URLSearchParams({ filter })
      if (debouncedSearch.length >= 2) p.set('q', debouncedSearch)
      const r = await fetch(`/api/conversaciones?${p}`)
      if (!r.ok) throw new Error('Error al cargar')
      return r.json()
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  })

  const threadQuery = useQuery<{ data: ConvThread }>({
    queryKey: ['conversacion', selectedId],
    queryFn: async () => {
      const r = await fetch(`/api/conversaciones/${selectedId}`)
      if (!r.ok) throw new Error('Error al cargar la conversación')
      return r.json()
    },
    enabled: !!selectedId,
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  })

  const thread = threadQuery.data?.data

  // Marcar como leída al abrir + bajar el badge del sidebar.
  useEffect(() => {
    if (!selectedId) return
    fetch(`/api/conversaciones/${selectedId}/read`, { method: 'POST' })
      .then(() => {
        qc.invalidateQueries({ queryKey: ['notification-counts'] })
        qc.invalidateQueries({ queryKey: ['conversaciones'] })
      })
      .catch(() => {})
  }, [selectedId, qc, thread?.messages.length])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [thread?.messages.length, selectedId])

  const select = (id: string | null) => {
    const p = new URLSearchParams(Array.from(searchParams.entries()))
    if (id) p.set('c', id)
    else p.delete('c')
    router.replace(`/conversaciones?${p}`)
    setReply('')
  }

  const doTakeover = async (active: boolean) => {
    if (!selectedId) return
    try {
      const r = await fetch(`/api/conversaciones/${selectedId}/takeover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      })
      if (!r.ok) throw new Error()
      toast.success(active ? 'Tomaste la conversación — NISSI no responde' : 'Devuelta a NISSI')
      threadQuery.refetch()
      listQuery.refetch()
    } catch {
      toast.error('No se pudo cambiar')
    }
  }

  const send = async () => {
    if (!selectedId || !reply.trim()) return
    setSending(true)
    try {
      const r = await fetch(`/api/conversaciones/${selectedId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: reply.trim() }),
      })
      const json = await r.json().catch(() => ({}))
      if (!r.ok) {
        toast.error(json.message || json.error || 'No se pudo enviar')
        return
      }
      setReply('')
      threadQuery.refetch()
      listQuery.refetch()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSending(false)
    }
  }

  const list = listQuery.data?.data ?? []
  const collected = useMemo(
    () => Object.entries(thread?.collectedData ?? {}).filter(([k]) => k !== 'origen'),
    [thread?.collectedData],
  )

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
          <MessageCircle size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Conversaciones de WhatsApp</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Lo que atiende NISSI. Podés responder desde acá — al hacerlo, NISSI deja de contestar en ese chat.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
        {/* ── Lista ─────────────────────────────────────────────── */}
        <div
          className={cn(
            'flex flex-col rounded-2xl overflow-hidden border',
            selectedId && 'hidden lg:flex',
          )}
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <div className="p-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="relative mb-2">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por teléfono o nombre…"
                className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                    filter === f.key ? 'gradient-bg text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {listQuery.isLoading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
              </div>
            ) : list.length === 0 ? (
              <p className="p-6 text-sm text-center text-[var(--color-text-muted)]">No hay conversaciones.</p>
            ) : (
              list.map((c) => (
                <button
                  key={c.id}
                  onClick={() => select(c.id)}
                  className={cn(
                    'w-full text-left px-3 py-3 border-b transition-colors',
                    selectedId === c.id ? 'bg-[var(--color-primary-light)]' : 'hover:bg-[var(--color-surface-raised)]',
                  )}
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-[var(--color-text)] truncate">
                      {c.customerName || `+${c.customerPhone}`}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-subtle)] shrink-0">{timeAgo(c.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {c.unread && <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] shrink-0" />}
                    <span className={cn('text-xs truncate flex-1', c.unread ? 'text-[var(--color-text)] font-medium' : 'text-[var(--color-text-muted)]')}>
                      {c.preview || '—'}
                    </span>
                  </div>
                  <div className="mt-1.5">{estadoBadge(c)}</div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Hilo ──────────────────────────────────────────────── */}
        <div
          className={cn(
            'flex flex-col rounded-2xl overflow-hidden border',
            !selectedId && 'hidden lg:flex',
          )}
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-muted)]">
              Elegí una conversación de la lista.
            </div>
          ) : threadQuery.isLoading || !thread ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-3 border-b flex items-start justify-between gap-3" style={{ borderColor: 'var(--color-border)' }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <button onClick={() => select(null)} className="lg:hidden text-[var(--color-text-muted)]">
                      <ArrowLeft size={16} />
                    </button>
                    <span className="font-semibold text-[var(--color-text)] truncate">
                      {thread.customerName || `+${thread.customerPhone}`}
                    </span>
                    {estadoBadge(thread)}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-[var(--color-text-subtle)] flex-wrap">
                    <span>+{thread.customerPhone}</span>
                    {thread.contacto && (
                      <Link href={`/contactos/${thread.contacto.id}`} className="text-[var(--color-primary)] hover:underline">
                        {thread.contacto.firstName} {thread.contacto.lastName}
                      </Link>
                    )}
                    {thread.deal && (
                      <Link href={`/pipeline?dealId=${thread.deal.id}`} className="text-[var(--color-primary)] hover:underline">
                        Oportunidad · {thread.deal.title}
                      </Link>
                    )}
                    {thread.ticket && (
                      <Link href={`/tickets/${thread.ticket.id}`} className="text-[var(--color-primary)] hover:underline">
                        Ticket #{thread.ticket.number}
                      </Link>
                    )}
                    {thread.assignedUser && <span>· lo maneja {thread.assignedUser.name}</span>}
                  </div>
                </div>
                <div className="shrink-0">
                  {thread.humanHandling ? (
                    <Button variant="ghost" size="xs" leftIcon={<RotateCcw size={13} />} onClick={() => doTakeover(false)}>
                      Devolver a NISSI
                    </Button>
                  ) : (
                    <Button variant="secondary" size="xs" leftIcon={<Hand size={13} />} onClick={() => doTakeover(true)}>
                      Tomar
                    </Button>
                  )}
                </div>
              </div>

              {/* Datos que juntó NISSI */}
              {collected.length > 0 && (
                <div className="px-3 py-2 border-b text-[11px] text-[var(--color-text-muted)] flex flex-wrap gap-x-3 gap-y-0.5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}>
                  {collected.map(([k, v]) => (
                    <span key={k}><b className="text-[var(--color-text)]">{k}:</b> {String(v)}</span>
                  ))}
                </div>
              )}

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {thread.messages.map((m) => {
                  const isCustomer = m.role === 'user'
                  return (
                    <div key={m.id} className={cn('flex', isCustomer ? 'justify-start' : 'justify-end')}>
                      <div
                        className={cn('max-w-[78%] rounded-2xl px-3 py-2 text-sm', isCustomer ? 'rounded-bl-sm' : 'rounded-br-sm')}
                        style={{
                          background: isCustomer ? 'var(--color-surface-raised)' : m.fromHuman ? 'var(--color-primary)' : 'var(--color-primary-light)',
                          color: isCustomer ? 'var(--color-text)' : m.fromHuman ? '#fff' : 'var(--color-primary)',
                        }}
                      >
                        <div className="flex items-center gap-1 text-[10px] opacity-70 mb-0.5">
                          {isCustomer ? <UserIcon size={10} /> : m.fromHuman ? <UserIcon size={10} /> : <Bot size={10} />}
                          {m.author} · {formatDateTime(m.createdAt)}
                        </div>
                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                      </div>
                    </div>
                  )
                })}
                <div ref={endRef} />
              </div>

              {/* Caja de respuesta */}
              <div className="p-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                {!thread.windowOpen ? (
                  <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 rounded-xl p-3 border border-amber-200">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    Fuera de la ventana de 24&nbsp;h de WhatsApp — el cliente tiene que volver a escribir para poder mandarle un mensaje de texto libre.
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); send() }
                      }}
                      rows={2}
                      placeholder="Escribí una respuesta… (Ctrl+Enter para enviar)"
                      className="flex-1 rounded-xl px-3 py-2 text-sm outline-none resize-none"
                      style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text)' }}
                    />
                    <Button onClick={send} loading={sending} disabled={!reply.trim()} leftIcon={<Send size={14} />}>
                      Enviar
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
