'use client'

// Ingreso al Portal de Clientes — enlace de acceso sin contraseña. El mail lo
// arma y lo manda NUESTRO backend (branded, desde el correo de la org), NO el
// template genérico de Supabase. Ver src/lib/portal-magic-link.ts.

import { useEffect, useState } from 'react'
import { Mail, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

const ERROR_MESSAGES: Record<string, string> = {
  denied: 'Ese email no tiene acceso al portal. Pedile a tu contacto en la empresa que te habilite.',
  link: 'El enlace no es válido o ya se usó. Pedí uno nuevo.',
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
  borderRadius: '0.75rem', padding: '0.6rem 0.85rem', fontSize: '0.9rem', color: 'var(--color-text)', outline: 'none',
}

export default function PortalLoginPage() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error')
    if (code && ERROR_MESSAGES[code]) setError(ERROR_MESSAGES[code])
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const value = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { setError('Ingresá un email válido.'); return }
    setSending(true)
    try {
      const res = await fetch('/api/portal/auth/request-link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: value }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? 'No pudimos enviar el enlace. Probá de nuevo en un rato.')
        return
      }
      setSent(true)
    } catch {
      setError('Error de conexión — probá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ maxWidth: 380, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ color: 'var(--color-text)', fontSize: 20, fontWeight: 700 }}>Portal de clientes</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 4 }}>Ingresá con tu email — te mandamos un enlace de acceso.</p>
        </div>

        {sent ? (
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 28, textAlign: 'center' }}>
            <CheckCircle2 size={36} style={{ color: '#10b981', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--color-text)', fontWeight: 600 }}>Revisá tu correo</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 6 }}>
              Si <strong>{email.trim().toLowerCase()}</strong> tiene acceso, te va a llegar un enlace para entrar. Puede tardar un minuto.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: 6 }}>Tu email</label>
            <input type="email" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@empresa.com" autoFocus />
            {error && (
              <p style={{ color: '#f87171', fontSize: 13, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={13} />{error}
              </p>
            )}
            <button
              type="submit"
              disabled={sending}
              style={{
                width: '100%', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 14, fontWeight: 600, color: '#fff', background: 'var(--color-primary)',
                borderRadius: 12, padding: '11px 0', border: 'none', cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.65 : 1,
              }}
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              {sending ? 'Enviando…' : 'Enviar enlace de acceso'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
