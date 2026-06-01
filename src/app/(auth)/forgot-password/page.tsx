'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
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
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (err) { setError(err.message); return }
      setSent(true)
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
          <Link href="/login" className="flex items-center gap-1.5 text-sm font-medium" style={{ color: '#64748b' }}>
            <ArrowLeft size={14} /> Volver al login
          </Link>
        </div>

        <div className="rounded-3xl p-8 lg:p-10"
          style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>

          {sent ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <Mail size={28} style={{ color: '#16a34a' }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: '#1e293b' }}>
                Revisá tu email
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>
                Si ese email está registrado, vas a recibir un link para restablecer tu contraseña en los próximos minutos.
              </p>
              <Link href="/login"
                className="inline-flex items-center gap-2 mt-6 text-sm font-semibold"
                style={{ color: 'var(--color-primary)' }}>
                <ArrowLeft size={14} /> Volver al login
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <h2 className="text-2xl font-bold mb-1.5" style={{ color: '#1e293b' }}>Recuperar contraseña</h2>
                <p className="text-sm" style={{ color: '#64748b' }}>
                  Ingresá tu email y te enviamos un link para restablecerla.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: '#475569' }}>
                    Email
                  </label>
                  <input
                    name="email"
                    type="email"
                    placeholder="tu@email.com"
                    autoComplete="email"
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
                  ) : <Mail size={16} />}
                  {isPending ? 'Enviando...' : 'Enviar link de recuperación'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
