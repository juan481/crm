'use client'

// Paso final de "olvidé mi contraseña" del Portal — mismo mecanismo que
// src/app/(auth)/reset-password/page.tsx (supabase-js ya armó la sesión de
// recuperación a partir del token en la URL; sólo hace falta updateUser),
// pero vuelve a /portal/login en vez de /login.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
  borderRadius: '0.75rem', padding: '0.6rem 0.85rem', fontSize: '0.9rem', color: 'var(--color-text)', outline: 'none',
}

export default function PortalResetPasswordPage() {
  const router = useRouter()
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd      = new FormData(e.currentTarget)
    const pass    = fd.get('password') as string
    const confirm = fd.get('confirm')  as string

    if (pass.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (pass !== confirm) { setError('Las contraseñas no coinciden.'); return }

    startTransition(async () => {
      const supabase = createClient()
      const { error: err } = await supabase.auth.updateUser({ password: pass })
      if (err) { setError(err.message); return }
      await supabase.auth.signOut()
      router.push('/portal/login?reset=ok')
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ maxWidth: 380, width: '100%' }}>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 24 }}>
          <Lock size={28} style={{ color: 'var(--color-primary)', marginBottom: 10 }} />
          <p style={{ color: 'var(--color-text)', fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Nueva contraseña</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>Elegí una contraseña segura de al menos 8 caracteres.</p>

          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: 6 }}>Nueva contraseña</label>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <input name="password" type={showPass ? 'text' : 'password'} required placeholder="Mínimo 8 caracteres" style={{ ...inputStyle, paddingRight: 40 }} />
              <button type="button" onClick={() => setShowPass(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-subtle)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: 6 }}>Confirmar contraseña</label>
            <input name="confirm" type={showPass ? 'text' : 'password'} required placeholder="Repetir contraseña" style={inputStyle} />

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
              {isPending ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
