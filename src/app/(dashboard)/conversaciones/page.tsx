'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  MessageCircle, Search, Send, Bot, User as UserIcon, ArrowLeft, Hand, RotateCcw,
  AlertTriangle, Check, CheckCheck, Clock, BarChart3, Inbox as InboxIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, timeAgo, formatDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'

// Lazy — recharts es pesado (~100KB) y sólo hace falta al abrir "Estadísticas".
const ConversacionesStats = dynamic(
  () => import('@/components/conversaciones/stats').then((m) => m.ConversacionesStats),
  { ssr: false, loading: () => <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div> },
)

interface ConvListItem {
  id: string
  customerPhone: string
  customerName: string | null
  status: 'ACTIVE' | 'HANDED_OFF' | 'CLOSED'
  humanHandling: boolean
  assignedUser: { id: string; name: string } | null
  handedOffTo: string | null
  lastMessageAt: string
  unread: boolean
  lastFailed: boolean
  preview: string
}

interface Msg {
  id: string
  role: string
  content: string
  createdAt: string
  author: string
  fromHuman: boolean
  deliveryStatus: string | null
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
  canReply: boolean
  windowOpen: boolean
  windowExpiresAt: string | null
  deal: { id: string; title: string; stage: string } | null
  ticket: { id: string; number: number; title: string; status: string } | null
  contacto: { id: string; firstName: string; lastName: string } | null
  messages: Msg[]
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

function DeliveryTick({ status }: { status: string | null }) {
  if (!status) return null
  if (status === 'pending') return <Clock size={11} className="opacity-60" />
  if (status === 'failed') return <AlertTriangle size={11} className="text-red-300" />
  if (status === 'read') return <CheckCheck size={12} className="text-sky-300" />
  if (status === 'delivered') return <CheckCheck size={12} className="opacity-70" />
  return <Check size={12} className="opacity-70" /> // sent
}

export default function ConversacionesPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const view = searchParams.get('v') === 'stats' ? 'stats' : 'inbox'

  const setView = (v: 'inbox' | 'stats') => {
    const p = new URLSearchParams(Array.from(searchParams.entries()))
    p.delete('c')
    if (v === 'stats') p.set('v', 'stats')
    else p.delete('v')
    router.replace(`/conversaciones?${p}`)
  }

  return (
    <div className="lg:h-[calc(100vh-11rem)] lg:flex lg:flex-col">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center shrink-0">
            <MessageCircle size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)]">Conversaciones de WhatsApp</h1>
            <p className="text-xs sm:text-sm text-[var(--color-text-muted)] hidden sm:block">
              Lo que atiende NISSI. Podés responder desde acá — al hacerlo, NISSI deja de contestar en ese chat.
            </p>
          </div>
        </div>
        <div className="flex rounded-xl overflow-hidden border shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={() => setView('inbox')}
            className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-semibold', view === 'inbox' ? 'gradient-bg text-white' : 'text-[var(--color-text-muted)]')}
          >
            <InboxIcon size={14} /> <span className="hidden sm:inline">Bandeja</span>
          </button>
          <button
            onClick={() => setView('stats')}
            className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-semibold', view === 'stats' ? 'gradient-bg text-white' : 'text-[var(--color-text-muted)]')}
          >
            <BarChart3 size={14} /> <span className="hidden sm:inline">Estadísticas</span>
          </button>
        </div>
      </div>

      {view === 'stats' ? <ConversacionesStats /> : <Inbox />}
    </div>
  )
}

function Inbox() {
  const qc = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get('c')

  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [optimistic, setOptimistic] = useState<Msg[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  const markedRef = useRef<string>('')
  const replyRef = useRef<HTMLTextAreaElement>(null)

  // Reset del alto del textarea cuando se vacía (tras enviar).
  useEffect(() => { if (!reply && replyRef.current) replyRef.current.style.height = 'auto' }, [reply])

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
    staleTime: 5000,
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
    staleTime: 4000,
    retry: 1,
  })

  const thread = threadQuery.data?.data

  // Mensajes a mostrar = los del servidor + los optimistas que todavía no
  // aparecieron en la respuesta del servidor (dedup por id).
  const messages: Msg[] = useMemo(() => {
    const base = thread?.messages ?? []
    const extra = optimistic.filter((o) => !base.some((m) => m.id === o.id))
    return [...base, ...extra]
  }, [thread?.messages, optimistic])

  useEffect(() => { setOptimistic([]); setReply('') }, [selectedId])

  // Marcar como leída al abrir y al llegar un mensaje nuevo — una vez por
  // (conversación + cantidad de mensajes), no en cada tick del polling.
  useEffect(() => {
    if (!selectedId || !thread) return
    const key = `${selectedId}:${thread.messages.length}`
    if (markedRef.current === key) return
    markedRef.current = key
    fetch(`/api/conversaciones/${selectedId}/read`, { method: 'POST' })
      .then(() => qc.invalidateQueries({ queryKey: ['notification-counts'] }))
      .catch(() => {})
  }, [selectedId, qc, thread])

  // Auto-scroll al fondo SÓLO si ya estabas cerca del fondo (no te tira para
  // abajo si subiste a leer contexto viejo). `nearBottom` se actualiza en el
  // onScroll del contenedor de mensajes.
  const nearBottomRef = useRef(true)
  useEffect(() => {
    if (nearBottomRef.current) endRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages.length, selectedId])

  const select = (id: string | null) => {
    const p = new URLSearchParams(Array.from(searchParams.entries()))
    if (id) p.set('c', id)
    else p.delete('c')
    router.replace(`/conversaciones?${p}`)
  }

  const doTakeover = async (active: boolean) => {
    if (!selectedId) return
    try {
      const r = await fetch(`/api/conversaciones/${selectedId}/takeover`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      })
      if (!r.ok) throw new Error()
      toast.success(active ? 'Tomaste la conversación — NISSI no responde' : 'Devuelta a NISSI')
      threadQuery.refetch(); listQuery.refetch()
    } catch { toast.error('No se pudo cambiar') }
  }

  const send = async () => {
    if (!selectedId || !reply.trim() || sending) return
    const text = reply.trim()
    const tempId = `temp-${Date.now()}`
    setReply('')
    setSending(true)
    nearBottomRef.current = true // al mandar, siempre baja al fondo
    setOptimistic((o) => [...o, {
      id: tempId, role: 'assistant', content: text, createdAt: new Date().toISOString(),
      author: 'vos', fromHuman: true, deliveryStatus: 'pending',
    }])
    try {
      const r = await fetch(`/api/conversaciones/${selectedId}/reply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const json = await r.json().catch(() => ({}))
      if (!r.ok) {
        setOptimistic((o) => o.map((m) => (m.id === tempId ? { ...m, deliveryStatus: 'failed' } : m)))
        setReply(text) // no perder lo escrito ante un fallo transitorio
        toast.error(json.message || json.error || 'No se pudo enviar')
        // La respuesta 502 con persisted=true ya guardó el mensaje como
        // fallido — refrescamos para que quede respaldado por la DB.
        if (json.persisted) threadQuery.refetch()
        return
      }
      const real = json.message as Msg | undefined
      if (real?.id) {
        setOptimistic((o) => o.map((m) => (m.id === tempId ? { ...real } : m)))
      } else {
        setOptimistic((o) => o.map((m) => (m.id === tempId ? { ...m, deliveryStatus: 'sent' } : m)))
      }
      threadQuery.refetch()
    } catch {
      setOptimistic((o) => o.map((m) => (m.id === tempId ? { ...m, deliveryStatus: 'failed' } : m)))
      setReply(text)
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
    <div className="lg:flex-1 lg:min-h-0 lg:grid lg:grid-cols-[340px_1fr] xl:grid-cols-[380px_1fr] lg:gap-4">
      {/* ── Lista ─────────────────────────────────────────────── */}
      <div
        className="flex flex-col rounded-2xl lg:overflow-hidden border lg:h-full"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="p-3 border-b shrink-0 sticky top-0 z-10 lg:static rounded-t-2xl" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="relative mb-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por teléfono o nombre…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                  filter === f.key ? 'gradient-bg text-white' : 'text-[var(--color-text-muted)] bg-[var(--color-surface-raised)]',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:flex-1 lg:overflow-y-auto">
          {listQuery.isLoading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : listQuery.isError ? (
            <p className="p-6 text-sm text-center text-[var(--color-text-muted)]">No se pudieron cargar. Reintentá.</p>
          ) : list.length === 0 ? (
            <p className="p-6 text-sm text-center text-[var(--color-text-muted)]">No hay conversaciones{filter !== 'all' ? ' con ese filtro' : ''}.</p>
          ) : (
            list.map((c) => (
              <button
                key={c.id}
                onClick={() => select(c.id)}
                className={cn(
                  'w-full text-left px-3 py-3 border-b transition-colors active:bg-[var(--color-surface-raised)]',
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
                  {c.lastFailed && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
                  <span className={cn('text-xs truncate flex-1', c.unread ? 'text-[var(--color-text)] font-medium' : 'text-[var(--color-text-muted)]')}>
                    {c.preview || '—'}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  {estadoBadge(c)}
                  {c.assignedUser && <span className="text-[10px] text-[var(--color-text-subtle)] truncate">{c.assignedUser.name}</span>}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Hilo ──────────────────────────────────────────────── */}
      <div
        className={cn(
          'flex-col overflow-hidden',
          selectedId ? 'fixed inset-0 z-50 flex' : 'hidden',
          'lg:static lg:z-auto lg:flex lg:rounded-2xl lg:border lg:h-full',
        )}
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-muted)]">
            Elegí una conversación de la lista.
          </div>
        ) : threadQuery.isError ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-[var(--color-text-muted)] p-6 text-center">
            No se pudo abrir esta conversación (puede que ya no exista).
            <Button variant="ghost" size="sm" onClick={() => select(null)}>Volver a la lista</Button>
          </div>
        ) : threadQuery.isLoading || !thread ? (
          <>
            <div className="px-3 py-2.5 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border)', paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}>
              <button onClick={() => select(null)} className="lg:hidden p-1 -ml-1 text-[var(--color-text-muted)]">
                <ArrowLeft size={18} />
              </button>
              <span className="text-sm text-[var(--color-text-muted)]">Cargando…</span>
            </div>
            <div className="flex-1 p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div
              className="px-3 py-2.5 border-b flex items-start justify-between gap-2"
              style={{ borderColor: 'var(--color-border)', paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <button onClick={() => select(null)} className="lg:hidden p-1 -ml-1 text-[var(--color-text-muted)]">
                    <ArrowLeft size={18} />
                  </button>
                  <span className="font-semibold text-[var(--color-text)] truncate">
                    {thread.customerName || `+${thread.customerPhone}`}
                  </span>
                  {estadoBadge(thread)}
                </div>
                <div className="flex items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-[var(--color-text-subtle)] flex-wrap">
                  <span>+{thread.customerPhone}</span>
                  {thread.contacto && (
                    <Link href={`/contactos/${thread.contacto.id}`} className="text-[var(--color-primary)] hover:underline">
                      {thread.contacto.firstName} {thread.contacto.lastName}
                    </Link>
                  )}
                  {thread.deal && (
                    <Link href={`/pipeline?dealId=${thread.deal.id}`} className="text-[var(--color-primary)] hover:underline truncate max-w-[160px]">
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
                {thread.canReply && (thread.humanHandling ? (
                  <Button variant="ghost" size="xs" leftIcon={<RotateCcw size={13} />} onClick={() => doTakeover(false)}>
                    <span className="hidden sm:inline">Devolver a </span>NISSI
                  </Button>
                ) : (
                  <Button variant="secondary" size="xs" leftIcon={<Hand size={13} />} onClick={() => doTakeover(true)}>
                    Tomar
                  </Button>
                ))}
              </div>
            </div>

            {/* Datos que juntó NISSI */}
            {collected.length > 0 && (
              <div className="px-3 py-2 border-b text-[11px] text-[var(--color-text-muted)] flex flex-wrap gap-x-3 gap-y-0.5 max-h-16 overflow-y-auto" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}>
                {collected.map(([k, v]) => (
                  <span key={k}><b className="text-[var(--color-text)]">{k}:</b> {String(v)}</span>
                ))}
              </div>
            )}

            {/* Mensajes */}
            <div
              className="flex-1 overflow-y-auto p-3 space-y-2 overscroll-contain"
              onScroll={(e) => {
                const el = e.currentTarget
                nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
              }}
            >
              {messages.map((m) => {
                const isCustomer = m.role === 'user'
                const failed = m.deliveryStatus === 'failed'
                return (
                  <div key={m.id} className={cn('flex', isCustomer ? 'justify-start' : 'justify-end')}>
                    <div
                      className={cn('max-w-[85%] sm:max-w-[78%] rounded-2xl px-3 py-2 text-sm', isCustomer ? 'rounded-bl-sm' : 'rounded-br-sm', failed && 'ring-1 ring-red-400')}
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
                      {!isCustomer && (
                        <div className="flex items-center justify-end gap-1 mt-0.5 text-[10px]">
                          {failed && <span className="text-red-300">no se envió</span>}
                          <DeliveryTick status={m.deliveryStatus} />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>

            {/* Caja de respuesta */}
            <div
              className="p-3 border-t"
              style={{ borderColor: 'var(--color-border)', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              {!thread.canReply ? (
                <div className="flex items-start gap-2 text-xs text-[var(--color-text-muted)] bg-surface-raised rounded-xl p-3">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  Tu rol puede ver la bandeja pero no responder. Un administrador lo habilita en Configuración → NISSI.
                </div>
              ) : !thread.windowOpen ? (
                <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 rounded-xl p-3 border border-amber-200">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  Fuera de la ventana de 24&nbsp;h de WhatsApp — el cliente tiene que volver a escribir para poder mandarle un mensaje de texto libre.
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <textarea
                    ref={replyRef}
                    value={reply}
                    onChange={(e) => {
                      setReply(e.target.value)
                      e.target.style.height = 'auto'
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`
                    }}
                    onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: 'nearest' }), 250)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); send() }
                    }}
                    rows={1}
                    placeholder="Escribí una respuesta…"
                    className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none resize-none max-h-32 leading-snug"
                    style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text)' }}
                  />
                  <Button onClick={send} loading={sending} disabled={!reply.trim()} leftIcon={<Send size={14} />} className="shrink-0">
                    <span className="hidden sm:inline">Enviar</span>
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
