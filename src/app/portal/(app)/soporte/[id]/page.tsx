'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ArrowLeft, Send } from 'lucide-react'

interface Msg { id: string; content: string; createdAt: string; autor: 'vos' | 'Soporte' }
interface TicketDetail {
  id: string; number: number; title: string; description: string; status: string
  category: string; createdAt: string; messages: Msg[]
}

const STATUS_LABEL: Record<string, string> = {
  ABIERTO: 'Abierto', EN_PROCESO: 'En proceso', ESPERANDO: 'Esperando respuesta',
  RESUELTO: 'Resuelto', CERRADO: 'Cerrado',
}

export default function PortalTicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  const load = () => fetch(`/api/portal/tickets/${id}`).then((r) => r.json()).then((j) => setTicket(j.data ?? null)).catch(() => setTicket(null)).finally(() => setLoading(false))
  useEffect(() => { load() }, [id])

  const send = async () => {
    if (!reply.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/portal/tickets/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: reply }),
      })
      if (res.ok) { setReply(''); load() }
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--color-text-subtle)' }} /></div>
  if (!ticket) return (
    <div>
      <Link href="/portal/soporte" className="text-sm flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}><ArrowLeft size={14} /> Volver</Link>
      <p className="text-sm mt-4" style={{ color: 'var(--color-text-muted)' }}>No encontramos este ticket.</p>
    </div>
  )

  const closed = ticket.status === 'CERRADO'

  return (
    <div className="space-y-4">
      <Link href="/portal/soporte" className="text-sm flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}><ArrowLeft size={14} /> Soporte</Link>

      <div>
        <h1 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{ticket.title}</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-subtle)' }}>
          #{String(ticket.number).padStart(4, '0')} · {STATUS_LABEL[ticket.status] ?? ticket.status}
        </p>
      </div>

      <div className="space-y-2">
        <Bubble autor="vos" content={ticket.description} date={ticket.createdAt} />
        {ticket.messages.filter((m) => m.content !== ticket.description || m.autor !== 'vos').map((m) => (
          <Bubble key={m.id} autor={m.autor} content={m.content} date={m.createdAt} />
        ))}
      </div>

      {!closed ? (
        <div className="flex gap-2 items-end">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Escribí una respuesta…"
            className="flex-1"
            style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: '0.6rem', padding: '0.5rem 0.7rem', fontSize: '0.875rem', color: 'var(--color-text)', outline: 'none', minHeight: 44, resize: 'none' }}
          />
          <button onClick={send} disabled={sending || !reply.trim()} className="p-2.5 rounded-lg text-white shrink-0" style={{ background: 'var(--color-primary)', opacity: sending || !reply.trim() ? 0.5 : 1 }}>
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      ) : (
        <p className="text-xs text-center" style={{ color: 'var(--color-text-subtle)' }}>Este ticket está cerrado. Abrí uno nuevo si necesitás algo más.</p>
      )}
    </div>
  )
}

function Bubble({ autor, content, date }: { autor: 'vos' | 'Soporte'; content: string; date: string }) {
  const mine = autor === 'vos'
  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '85%', background: mine ? 'var(--color-primary)' : 'var(--color-surface)', color: mine ? '#fff' : 'var(--color-text)', border: mine ? 'none' : '1px solid var(--color-border)', borderRadius: 14, padding: '9px 13px' }}>
        <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{content}</p>
        <p style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}>{new Date(date).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
      </div>
    </div>
  )
}
