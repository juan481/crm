'use client'

// Ingreso al Portal de Clientes — dos caminos:
//  1) Email + contraseña (una vez que el cliente configuró una en "Mi cuenta").
//  2) Enlace de acceso por email (magic link) — sigue existiendo para la
//     primera entrada (antes de tener contraseña) y como respaldo si la
//     olvidó. El mail lo arma y lo manda NUESTRO backend (branded, desde el
//     correo de la org), NO el template genérico de Supabase — ver
//     src/lib/portal-magic-link.ts.
//
// El guard de rol (sólo CLIENTE con Empresa puede quedarse en /portal) vive
// en /portal/(app)/layout.tsx y se aplica sin importar por cuál de los dos
// caminos entró — no hace falta duplicarlo acá.

import { Suspense, useEffect, useRef, useState, useTransition } from 'react'
import Script from 'next/script'
import { Mail, CheckCircle2, AlertTriangle, Loader2, Lock, Eye, EyeOff, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string
      reset:  (widgetId: string) => void
    }
  }
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

const ERROR_MESSAGES: Record<string, string> = {
  denied: 'Ese email no tiene acceso al portal. Pedile a tu contacto en la empresa que te habilite.',
  link: 'El enlace no es válido o ya se usó. Pedí uno nuevo.',
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
  borderRadius: '0.75rem', padding: '0.6rem 0.85rem', fontSize: '0.9rem', color: 'var(--color-text)', outline: 'none',
}

export default function PortalLoginPage() {
  return (
    <Suspense fallback={null}>
      <PortalLoginForm />
    </Suspense>
  )
}

function PortalLoginForm() {
  const [mode, setMode] = useState<'password' | 'link'>('password')

  // ── Modo contraseña ──
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const turnstileEl = useRef<HTMLDivElement>(null)
  const widgetId     = useRef<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)

  const renderTurnstile = () => {
    if (!TURNSTILE_SITE_KEY || !turnstileEl.current || !window.turnstile) return
    widgetId.current = window.turnstile.render(turnstileEl.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token: string) => setCaptchaToken(token),
      'expired-callback': () => setCaptchaToken(null),
      'error-callback':   () => setCaptchaToken(null),
    })
  }

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error')
    if (code && ERROR_MESSAGES[code]) setError(ERROR_MESSAGES[code])
    if (new URLSearchParams(window.location.search).get('reset') === 'ok') {
      setError(null)
    }
  }, [])

  // El <Script> de Turnstile sólo llama a onLoad la PRIMERA vez que termina
  // de cargar — si el usuario pasa a modo "link" (el contenedor del widget
  // se desmonta) y vuelve a "password", el script ya está cargado y onLoad
  // no se repite, así que el widget quedaba vacío para siempre (botón
  // bloqueado porque nunca llega un captchaToken). Este efecto cubre ese
  // caso: cuando se vuelve a modo "password" y el script ya estaba
  // cargado, lo vuelve a renderizar en el contenedor nuevo.
  useEffect(() => {
    if (mode === 'password' && window.turnstile) renderTurnstile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const value = email.trim().toLowerCase()
    if (!value || !password) { setError('Completá email y contraseña.'); return }
    if (TURNSTILE_SITE_KEY && !captchaToken) { setError('Completá la verificación de seguridad.'); return }

    startTransition(async () => {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: value, password,
        ...(captchaToken ? { options: { captchaToken } } : {}),
      })
      if (authError) {
        setError(
          authError.message === 'Invalid login credentials'
            ? 'Email o contraseña incorrectos. Si todavía no configuraste una contraseña, usá "Entrar con un enlace por email".'
            : authError.message
        )
        if (window.turnstile && widgetId.current) window.turnstile.reset(widgetId.current)
        setCaptchaToken(null)
        return
      }
      window.location.href = '/portal'
    })
  }

  // ── Modo enlace por email ──
  const [linkEmail, setLinkEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const submitLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const value = linkEmail.trim().toLowerCase()
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
      {TURNSTILE_SITE_KEY && mode === 'password' && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer onLoad={renderTurnstile} />
      )}
      <div style={{ maxWidth: 380, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ color: 'var(--color-text)', fontSize: 20, fontWeight: 700 }}>Portal de clientes</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 4 }}>
            {mode === 'password' ? 'Ingresá con tu email y contraseña.' : 'Ingresá con tu email — te mandamos un enlace de acceso.'}
          </p>
        </div>

        {mode === 'password' ? (
          <form onSubmit={submitPassword} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: 6 }}>Tu email</label>
            <input
              type="email" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="vos@empresa.com" autoComplete="email" autoFocus
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>Contraseña</label>
              <a href="/portal/forgot-password" style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-primary)' }}>¿Olvidaste tu contraseña?</a>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'} style={{ ...inputStyle, paddingRight: 40 }}
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••" autoComplete="current-password"
              />
              <button
                type="button" onClick={() => setShowPass((v) => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-subtle)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {error && (
              <p style={{ color: '#f87171', fontSize: 13, marginTop: 10, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <AlertTriangle size={13} style={{ marginTop: 2, flexShrink: 0 }} />{error}
              </p>
            )}

            {TURNSTILE_SITE_KEY && <div ref={turnstileEl} style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }} />}

            <button
              type="submit"
              disabled={isPending || (!!TURNSTILE_SITE_KEY && !captchaToken)}
              style={{
                width: '100%', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 14, fontWeight: 600, color: '#fff', background: 'var(--color-primary)',
                borderRadius: 12, padding: '11px 0', border: 'none', cursor: isPending ? 'default' : 'pointer', opacity: isPending ? 0.65 : 1,
              }}
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              {isPending ? 'Ingresando…' : 'Iniciar sesión'}
            </button>

            <button
              type="button"
              onClick={() => { setMode('link'); setError(null) }}
              style={{ width: '100%', marginTop: 12, textAlign: 'center', fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ¿Primera vez o no tenés contraseña? Entrar con un enlace por email
            </button>
          </form>
        ) : sent ? (
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 28, textAlign: 'center' }}>
            <CheckCircle2 size={36} style={{ color: '#10b981', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--color-text)', fontWeight: 600 }}>Revisá tu correo</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 6 }}>
              Si <strong>{linkEmail.trim().toLowerCase()}</strong> tiene acceso, te va a llegar un enlace para entrar. Puede tardar un minuto.
              Una vez adentro, podés configurar una contraseña en &quot;Mi cuenta&quot; para no depender más del enlace.
            </p>
          </div>
        ) : (
          <form onSubmit={submitLink} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: 6 }}>Tu email</label>
            <input type="email" style={inputStyle} value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} placeholder="vos@empresa.com" autoFocus />
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
            <button
              type="button"
              onClick={() => { setMode('password'); setError(null) }}
              style={{ width: '100%', marginTop: 12, textAlign: 'center', fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <KeyRound size={13} /> Ya tengo contraseña
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
