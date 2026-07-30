'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Star, CheckCircle2, MailX } from 'lucide-react'

interface RatingTicket {
  number: number
  title: string
  status: string
  satisfactionRating: number | null
  satisfactionRatedAt: string | null
  organization: { name: string | null; crmName: string | null; primaryColor: string | null; secondaryColor: string | null } | null
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bg)', padding: '24px',
    }}>
      <div style={{
        maxWidth: 440, width: '100%', textAlign: 'center',
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 24, padding: '40px 32px',
      }}>
        {children}
      </div>
    </div>
  )
}

export default function ValorarTicketPage() {
  const { token } = useParams<{ token: string }>()
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery<RatingTicket>({
    queryKey: ['ticket-rating', token],
    queryFn: async () => {
      const res = await fetch(`/api/public/ticket-rating/${token}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      return json.data
    },
    retry: false,
  })

  const handleSubmit = async () => {
    if (!rating) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/ticket-rating/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al enviar'); return }
      setSubmitted(true)
    } catch {
      setError('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) return <Shell><p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Cargando...</p></Shell>

  if (!data) {
    return (
      <Shell>
        <div style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(148,163,184,0.12)', color: 'var(--color-text-muted)',
        }}>
          <MailX size={26} />
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>Enlace inválido</h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>
          Este enlace de calificación no es válido o expiró.
        </p>
      </Shell>
    )
  }

  const orgName = data.organization?.name || data.organization?.crmName || 'nuestro equipo'
  const primaryColor = data.organization?.primaryColor || '#6366f1'
  const alreadyRated = !!data.satisfactionRatedAt
  const stillOpen = data.status !== 'RESUELTO' && data.status !== 'CERRADO'

  if (!alreadyRated && !submitted && stillOpen) {
    return (
      <Shell>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>
          El ticket #{String(data.number).padStart(4, '0')} fue reabierto y todavía está en curso. Vas a poder calificar la atención cuando {orgName} lo resuelva de nuevo.
        </p>
      </Shell>
    )
  }

  if (alreadyRated || submitted) {
    return (
      <Shell>
        <div style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(16,185,129,0.12)', color: '#10b981',
        }}>
          <CheckCircle2 size={26} />
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>
          ¡Gracias por tu calificación!
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>
          Tu opinión sobre el ticket #{String(data.number).padStart(4, '0')} nos ayuda a mejorar. Podés cerrar esta ventana.
        </p>
      </Shell>
    )
  }

  return (
    <Shell>
      <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-subtle)', margin: '0 0 8px' }}>
        Ticket #{String(data.number).padStart(4, '0')}
      </p>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 6px' }}>
        {data.title}
      </h1>
      <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6, margin: '0 0 24px' }}>
        ¿Cómo calificarías la atención que recibiste de {orgName}?
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <Star
              size={32}
              fill={(hovered || rating) >= n ? primaryColor : 'none'}
              color={(hovered || rating) >= n ? primaryColor : 'var(--color-border-strong)'}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comentario (opcional)"
        rows={3}
        style={{
          width: '100%', borderRadius: 12, border: '1px solid var(--color-border)',
          background: 'var(--color-surface-raised)', color: 'var(--color-text)',
          padding: '10px 12px', fontSize: 14, resize: 'none', marginBottom: 16, outline: 'none',
        }}
      />

      {error && <p style={{ fontSize: 13, color: '#ef4444', margin: '0 0 12px' }}>{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!rating || submitting}
        style={{
          width: '100%', padding: '11px', borderRadius: 12, border: 'none',
          background: primaryColor, color: '#fff', fontSize: 14, fontWeight: 600,
          cursor: rating ? 'pointer' : 'not-allowed', opacity: !rating || submitting ? 0.6 : 1,
        }}
      >
        {submitting ? 'Enviando...' : 'Enviar calificación'}
      </button>
    </Shell>
  )
}
