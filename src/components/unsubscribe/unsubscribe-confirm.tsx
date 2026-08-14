'use client'

import { useState } from 'react'
import { MailX, CheckCircle2 } from 'lucide-react'

function Shell({ ok, title, message, children }: { ok: boolean; title: string; message: string; children?: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bg)', padding: '24px',
    }}>
      <div style={{
        maxWidth: 420, width: '100%', textAlign: 'center',
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 24, padding: '40px 32px',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.12)',
          color: ok ? '#10b981' : 'var(--color-text-muted)',
        }}>
          {ok ? <CheckCircle2 size={26} /> : <MailX size={26} />}
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>{title}</h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>{message}</p>
        {children}
      </div>
    </div>
  )
}

// La mutación real (POST /api/unsubscribe/[recipientId]) sólo se dispara acá,
// con un click explícito — nunca al cargar la página. Ver el porqué en
// src/app/api/unsubscribe/[recipientId]/route.ts.
export function UnsubscribeConfirm({ recipientId, email, orgName }: { recipientId: string; email: string; orgName: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const handleConfirm = async () => {
    setState('loading')
    try {
      const res = await fetch(`/api/unsubscribe/${recipientId}`, { method: 'POST' })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <Shell ok title="Listo, te dimos de baja"
        message={`${email} no va a recibir más comunicaciones de ${orgName}. Podés cerrar esta ventana.`} />
    )
  }

  if (state === 'error') {
    return (
      <Shell ok={false} title="No pudimos procesar la baja"
        message="Intentá de nuevo en unos minutos, o respondé a alguno de los correos para que lo resolvamos manualmente." />
    )
  }

  return (
    <Shell ok={false} title="¿Dejar de recibir correos?"
      message={`Vas a dejar de recibir comunicaciones de ${orgName} en ${email}.`}>
      <button
        onClick={handleConfirm}
        disabled={state === 'loading'}
        style={{
          marginTop: 20, padding: '10px 24px', borderRadius: 12, border: 'none',
          background: 'var(--color-primary, #6366f1)', color: '#fff', fontSize: 14, fontWeight: 600,
          cursor: state === 'loading' ? 'default' : 'pointer', opacity: state === 'loading' ? 0.6 : 1,
        }}
      >
        {state === 'loading' ? 'Procesando...' : 'Confirmar baja'}
      </button>
    </Shell>
  )
}
