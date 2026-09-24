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
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-[#f1f4f8] via-[#e8edf4] to-[#dfe5ed] relative overflow-hidden text-[#181c1f] font-poppins antialiased">
      {/* Resplandor ambiental suave en el fondo */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-white/70 blur-[90px] pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] rounded-full bg-[#00628e]/10 blur-[80px] pointer-events-none" />

      <div className="w-full max-w-[440px] relative z-10">
        <div className="flex items-center justify-between mb-8">
          <Link href="/login" className="transition-transform hover:scale-[1.03]">
            <img src="/logo-fondo-redondeado.png" alt="JustCRM Logo" className="h-14 sm:h-16 w-auto object-contain shadow-lg" />
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-xs font-medium text-[#40484f] hover:text-[#00628e] transition-colors"
          >
            <ArrowLeft size={14} /> Volver al login
          </Link>
        </div>

        <div className="bg-white rounded-[28px] p-8 sm:p-10 border border-[#d6dde5] shadow-[0_20px_50px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)]">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-[#f1f4f8] border border-[#d6dde5]">
                <Mail size={24} className="text-[#00628e]" />
              </div>
              <h2 className="text-2xl font-semibold text-[#181c1f] mb-2 tracking-tight">Revisá tu email</h2>
              <p className="text-xs sm:text-sm text-[#40484f] leading-relaxed font-normal">
                Si ese email está registrado en el sistema, vas a recibir un enlace seguro para restablecer tu contraseña en los próximos minutos.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 mt-6 text-xs sm:text-sm font-medium text-[#00628e] hover:underline"
              >
                <ArrowLeft size={14} /> Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <h2 className="text-2xl font-semibold text-[#181c1f] mb-1.5 tracking-tight">Recuperar contraseña</h2>
                <p className="text-xs sm:text-sm text-[#5f5e5e] font-normal">
                  Ingresá tu correo registrado y te enviaremos las instrucciones de restablecimiento.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#40484f] mb-1.5">
                    Correo electrónico
                  </label>
                  <input
                    name="email"
                    type="email"
                    placeholder="usuario@empresa.com"
                    autoComplete="email"
                    required
                    className="w-full bg-[#f8fafc] border border-[#d6dde5] focus:border-[#00628e] focus:bg-white focus:ring-2 focus:ring-[#00628e]/15 text-[#181c1f] placeholder-[#707880] rounded-xl px-4 py-3 text-sm outline-none transition-all font-normal"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-medium bg-[#ffdad6] border border-[#ba1a1a]/20 text-[#93000a]">
                    <span className="shrink-0 font-semibold">✕</span> {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full font-medium text-sm text-white bg-[#00628e] hover:bg-[#00496b] transition-all transform hover:-translate-y-0.5 disabled:opacity-60 cursor-pointer shadow-md shadow-[#00628e]/25 mt-2"
                >
                  {isPending ? (
                    <span className="w-4 h-4 border-2 rounded-full animate-spin border-white/30 border-t-white" />
                  ) : (
                    <Mail size={16} />
                  )}
                  <span>{isPending ? 'Enviando...' : 'Enviar link de recuperación'}</span>
                </button>
              </form>
            </>
          )}

          <div className="mt-8 pt-5 flex items-center justify-center border-t border-[#f1f4f8]">
            <a
              href="https://justcreate.com.ar"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[11px] text-[#707880] hover:text-[#00628e] transition-colors group"
            >
              <span className="font-normal">powered by</span>
              <img
                src="/just-create-logo.png"
                alt="Just Create"
                className="h-4 w-auto object-contain transition-transform group-hover:scale-105"
              />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
