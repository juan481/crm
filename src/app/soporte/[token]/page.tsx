'use client'

// Formulario público de autogestión de tickets — sin login, pensado para
// que un cliente final abra su propia consulta. Ver Fase 13 del plan.
// Adjuntos quedan fuera de esta primera versión a propósito: subir
// archivos sin autenticar es superficie sensible (validación de
// tipo/tamaño, abuso) que no queremos apurar — para eso sigue estando el
// flujo de mensajes del ticket una vez creado (ahí sí, autenticado).
//
// Usa los mismos tokens var(--color-*) que el resto del CRM (definidos en
// globals.css a nivel :root/.dark, disponibles acá aunque esta página vive
// fuera del dashboard) — mismo look, sin depender de styled-jsx.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, LifeBuoy, AlertTriangle } from 'lucide-react'

interface OrgBranding {
  name: string
  crmName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border)',
  borderRadius: '0.75rem',
  padding: '0.55rem 0.75rem',
  fontSize: '0.875rem',
  color: 'var(--color-text)',
  outline: 'none',
}

export default function SoportePublicoPage() {
  const { token } = useParams<{ token: string }>()
  const [org, setOrg] = useState<OrgBranding | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

  // `website` es el honeypot (ver src/app/api/public/tickets/[token]/route.ts)
  // — un humano nunca lo completa, queda oculto visualmente.
  const [form, setForm] = useState({ name: '', email: '', empresa: '', title: '', description: '', website: '' })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ticketNumber, setTicketNumber] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/public/tickets/${token}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((j) => setOrg(j.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.name.trim() || !form.email.trim() || !form.title.trim() || !form.description.trim()) {
      setError('Completá todos los campos obligatorios.')
      return
    }
    setSending(true)
    try {
      const res = await fetch(`/api/public/tickets/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'No se pudo enviar tu consulta'); return }
      setTicketNumber(json.data.number)
    } catch {
      setError('Error de conexión — probá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  const accent = org?.primaryColor || 'var(--color-primary)'

  if (loading) {
    return <div className="min-h-screen" style={{ background: 'var(--color-bg)' }} />
  }

  if (notFound || !org) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-bg)' }}>
        <div className="text-center" style={{ color: 'var(--color-text-muted)' }}>
          <AlertTriangle className="mx-auto mb-3" style={{ color: 'var(--color-text-subtle)' }} size={32} />
          <p className="font-medium" style={{ color: 'var(--color-text)' }}>Este link no es válido.</p>
          <p className="text-sm mt-1">Pedile a la empresa que te lo confirme.</p>
        </div>
      </div>
    )
  }

  const orgName = org.name || org.crmName

  if (ticketNumber !== null) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-bg)' }}>
        <div className="max-w-sm w-full text-center rounded-2xl p-8" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <CheckCircle2 className="mx-auto mb-3" size={36} style={{ color: accent }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>¡Listo, recibimos tu consulta!</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Es el ticket #{String(ticketNumber).padStart(4, '0')} de {orgName}. Te vamos a responder por email a la casilla que dejaste.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-10 flex flex-col items-center" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-md w-full">
        <div className="flex flex-col items-center text-center mb-6">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt={orgName} className="w-12 h-12 rounded-xl object-contain mb-3" />
          ) : (
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold mb-3" style={{ background: accent }}>
              {orgName.charAt(0)}
            </div>
          )}
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Contactar a {orgName}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Dejanos tu consulta y te respondemos por email.</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          {/* Honeypot — invisible para una persona, los bots que autocompletan
              formularios genéricos suelen llenarlo igual. */}
          <input
            type="text"
            name="website"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            tabIndex={-1}
            autoComplete="off"
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            aria-hidden="true"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tu nombre" required>
              <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Tu email" required>
              <input type="email" style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>
          <Field label="Empresa (opcional)">
            <input style={inputStyle} value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
          </Field>
          <Field label="Asunto" required>
            <input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Contanos qué necesitás" required>
            <textarea style={{ ...inputStyle, minHeight: 100, resize: 'none' }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>

          {error && (
            <p className="text-sm flex items-center gap-1.5" style={{ color: '#f87171' }}><AlertTriangle size={13} />{error}</p>
          )}

          <button
            type="submit"
            disabled={sending}
            className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white rounded-xl py-2.5 transition-opacity disabled:opacity-60"
            style={{ background: accent }}
          >
            <LifeBuoy size={15} />
            {sending ? 'Enviando...' : 'Enviar consulta'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
        {label}{required && <span style={{ color: '#f87171' }}> *</span>}
      </span>
      {children}
    </label>
  )
}
