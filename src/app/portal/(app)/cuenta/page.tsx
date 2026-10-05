'use client'

// "Mi cuenta" del Portal de Clientes — configurar/cambiar la contraseña
// mientras ya está logueado (sesión real de Supabase, misma llamada que
// /portal/reset-password: supabase.auth.updateUser). No pide la contraseña
// actual porque la sesión ya está autenticada — igual criterio que
// src/app/(auth)/reset-password/page.tsx para el CRM interno.
//
// Objetivo: que el cliente configure una contraseña UNA vez (entrando por el
// enlace de email la primera vez) y a partir de ahí entre siempre con
// email + contraseña, sin depender de un enlace nuevo cada vez.

import { useState, useTransition } from 'react'
import { KeyRound, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
  borderRadius: '0.75rem', padding: '0.6rem 0.85rem', fontSize: '0.9rem', color: 'var(--color-text)', outline: 'none',
}

export default function PortalCuentaPage() {
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setDone(false)
    const form    = e.currentTarget // capturado ANTES del await — React anula e.currentTarget en cuanto este handler síncrono termina
    const fd       = new FormData(form)
    const pass    = fd.get('password') as string
    const confirm = fd.get('confirm')  as string

    if (pass.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (pass !== confirm) { setError('Las contraseñas no coinciden.'); return }

    startTransition(async () => {
      const supabase = createClient()
      const { error: err } = await supabase.auth.updateUser({ password: pass })
      if (err) { setError(err.message); return }
      setDone(true)
      form.reset()
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>Mi cuenta</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Configurá una contraseña para entrar directo la próxima vez, sin esperar un enlace por email.</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={15} style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-subtle)' }}>Contraseña</p>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Nueva contraseña</label>
          <div className="relative">
            <input name="password" type={showPass ? 'text' : 'password'} required placeholder="Mínimo 8 caracteres" style={{ ...inputStyle, paddingRight: 40 }} />
            <button type="button" onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-subtle)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Confirmar contraseña</label>
          <input name="confirm" type={showPass ? 'text' : 'password'} required placeholder="Repetir contraseña" style={inputStyle} />
        </div>

        {error && <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>}
        {done && (
          <p style={{ color: '#10b981', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={14} /> Contraseña actualizada — ya podés usarla la próxima vez que entres.
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          style={{
            width: '100%', marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontSize: 14, fontWeight: 600, color: '#fff', background: 'var(--color-primary)',
            borderRadius: 12, padding: '11px 0', border: 'none', cursor: isPending ? 'default' : 'pointer', opacity: isPending ? 0.65 : 1,
          }}
        >
          {isPending ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </div>
  )
}
