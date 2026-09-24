'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft } from 'lucide-react'
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
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#070b14] text-slate-100 font-poppins relative overflow-hidden">
      {/* Glows ambientales con el color corporativo */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[140px] pointer-events-none opacity-30"
        style={{ background: 'radial-gradient(circle, hsl(197.07deg 95.35% 25.29%), transparent 70%)' }}
      />

      <div className="w-full max-w-[440px] relative z-10">
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-11 h-11 rounded-2xl overflow-hidden bg-slate-900 border p-1 flex items-center justify-center shadow-lg"
            style={{ borderColor: 'rgba(5, 163, 225, 0.35)', boxShadow: '0 4px 16px rgba(3, 91, 126, 0.3)' }}
          >
            <img src="/app-icon.png" alt="JustCRM Icon" className="w-full h-full object-contain" />
          </div>
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> Volver al login
          </Link>
        </div>

        <div
          className="rounded-3xl p-8 sm:p-10 border backdrop-blur-2xl shadow-2xl"
          style={{
            background: 'linear-gradient(180deg, rgba(13, 22, 38, 0.92) 0%, rgba(7, 13, 24, 0.96) 100%)',
            borderColor: 'rgba(5, 163, 225, 0.25)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(3, 91, 126, 0.2)',
          }}
        >
          {sent ? (
            <div className="text-center py-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 border"
                style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }}
              >
                <Mail size={28} className="text-emerald-400" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Revisá tu email</h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Si ese email está registrado en el sistema, vas a recibir un enlace seguro para restablecer tu contraseña en los próximos minutos.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 mt-6 text-xs sm:text-sm font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <ArrowLeft size={14} /> Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <h2 className="text-2xl font-black text-white mb-1.5">Recuperar contraseña</h2>
                <p className="text-xs sm:text-sm text-slate-400">
                  Ingresá tu correo registrado y te enviaremos las instrucciones de restablecimiento.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Correo Electrónico
                  </label>
                  <input
                    name="email"
                    type="email"
                    placeholder="usuario@empresa.com"
                    autoComplete="email"
                    required
                    className="w-full bg-[#070e1a] border border-slate-700/80 focus:border-[#05a3e1] focus:ring-2 focus:ring-[#05a3e1]/25 text-white placeholder-slate-500 rounded-xl px-4 py-3.5 text-sm outline-none transition-all font-medium"
                  />
                </div>

                {error && (
                  <div
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-medium border"
                    style={{ background: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171' }}
                  >
                    <span className="shrink-0 font-bold">✕</span> {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-black text-sm text-white transition-all transform hover:-translate-y-0.5 disabled:opacity-60 cursor-pointer shadow-xl"
                  style={{
                    background: 'linear-gradient(135deg, hsl(197.07deg 95.35% 25.29%) 0%, #05a3e1 100%)',
                    boxShadow: '0 8px 24px rgba(3, 91, 126, 0.45)',
                  }}
                >
                  {isPending ? (
                    <span
                      className="w-4 h-4 border-2 rounded-full animate-spin"
                      style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }}
                    />
                  ) : (
                    <Mail size={18} />
                  )}
                  <span>{isPending ? 'Enviando...' : 'Enviar link de recuperación'}</span>
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
