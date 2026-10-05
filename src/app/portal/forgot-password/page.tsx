'use client'

// "Olvidé mi contraseña" del Portal de Clientes — mismo mecanismo que
// src/app/(auth)/forgot-password/page.tsx (Supabase resetPasswordForEmail),
// sólo que el redirectTo apunta a /portal/reset-password en vez de
// /reset-password, para volver al carril del portal y no al del CRM interno.

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
  borderRadius: '0.75rem', padding: '0.6rem 0.85rem', fontSize: '0.9rem', color: 'var(--color-text)', outline: 'none',
}

export default function PortalForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const email = (new FormData(e.currentTarget).get('email') as string).trim()
    if (!email) { setError('Ingresá tu email.'); return }

    startTransition(async () => {
      const supabase = createClient()
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/portal/reset-password`,
      })
      if (err) { setError(err.message); return }
      setSent(true)
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ maxWidth: 380, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Link href="/portal/login" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
            <ArrowLeft size={13} /> Volver al login
          </Link>
        </div>

        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 24 }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <Mail size={32} style={{ color: 'var(--color-primary)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--color-text)', fontWeight: 600 }}>Revisá tu email</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 6 }}>
                Si ese email tiene acceso al portal, vas a recibir un enlace para configurar una nueva contraseña en los próximos minutos.
              </p>
              <Link href="/portal/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: 13, fontWeight: 500, color: 'var(--color-primary)' }}>
                <ArrowLeft size={13} /> Volver al login
              </Link>
            </div>
          ) : (
            <>
              <p style={{ color: 'var(--color-text)', fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Recuperar contraseña</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>Ingresá tu email del portal y te mandamos un enlace para elegir una contraseña nueva.</p>
              <form onSubmit={handleSubmit}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: 6 }}>Tu email</label>
                <input name="email" type="email" required autoFocus autoComplete="email" placeholder="vos@empresa.com" style={inputStyle} />
                {error && <p style={{ color: '#f87171', fontSize: 13, marginTop: 10 }}>{error}</p>}
                <button
                  type="submit"
                  disabled={isPending}
                  style={{
                    width: '100%', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontSize: 14, fontWeight: 600, color: '#fff', background: 'var(--color-primary)',
                    borderRadius: 12, padding: '11px 0', border: 'none', cursor: isPending ? 'default' : 'pointer', opacity: isPending ? 0.65 : 1,
                  }}
                >
                  {isPending ? 'Enviando…' : 'Enviar enlace de recuperación'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
