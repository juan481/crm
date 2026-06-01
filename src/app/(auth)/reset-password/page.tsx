'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Shield, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [showPass, setShowPass] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd      = new FormData(e.currentTarget)
    const pass    = fd.get('password')    as string
    const confirm = fd.get('confirm')     as string

    if (pass.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (pass !== confirm) { setError('Las contraseñas no coinciden.'); return }

    startTransition(async () => {
      const supabase = createClient()
      const { error: err } = await supabase.auth.updateUser({ password: pass })
      if (err) { setError(err.message); return }
      // Sign out and redirect so they log in fresh
      await supabase.auth.signOut()
      router.push('/login?reset=ok')
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#f8fafc' }}>
      <div className="w-full max-w-[420px]">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Shield size={18} />
          </div>
        </div>

        <div className="rounded-3xl p-8 lg:p-10"
          style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <div className="mb-7">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: '#ede9fe' }}>
              <Lock size={24} style={{ color: '#6366f1' }} />
            </div>
            <h2 className="text-2xl font-bold mb-1.5" style={{ color: '#1e293b' }}>
              Nueva contraseña
            </h2>
            <p className="text-sm" style={{ color: '#64748b' }}>
              Elegí una contraseña segura de al menos 8 caracteres.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#475569' }}>
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  required
                  className="form-input pr-12"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#475569' }}>
                Confirmar contraseña
              </label>
              <input
                name="confirm"
                type={showPass ? 'text' : 'password'}
                placeholder="Repetir contraseña"
                required
                className="form-input"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm"
                style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
                <span className="shrink-0">✕</span> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl font-semibold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
              {isPending ? (
                <span className="w-4 h-4 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
              ) : <Lock size={16} />}
              {isPending ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
