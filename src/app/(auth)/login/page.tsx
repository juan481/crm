'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, LogIn, Shield } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useThemeStore } from '@/store/theme-store'

export default function LoginPage() {
  const router = useRouter()
  const { crmName } = useThemeStore()
  const [showPass, setShowPass] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd       = new FormData(e.currentTarget)
    const email    = (fd.get('email')    as string).trim()
    const password = fd.get('password') as string

    if (!email || !password) { setError('Completá todos los campos.'); return }

    startTransition(async () => {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        setError(
          authError.message === 'Invalid login credentials'
            ? 'Email o contraseña incorrectos.'
            : authError.message
        )
        return
      }

      // Session cookie is set by Supabase SSR — redirect triggers layout auth check
      router.push('/dashboard')
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#f8fafc' }}>
      {/* ── Left panel: dark navy ─────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[42%] flex-col justify-between p-14 relative overflow-hidden"
        style={{ background: '#0f172a' }}
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="absolute top-32 -left-16 w-72 h-72 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
        <div className="absolute bottom-24 right-8 w-56 h-56 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />

        <div className="relative z-10 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <Shield size={20} />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">{crmName}</span>
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Gestiona tu<br />negocio de forma<br />
            <span style={{ color: '#818cf8' }}>inteligente.</span>
          </h1>
          <p style={{ color: 'rgba(148,163,184,0.9)' }} className="text-base leading-relaxed">
            CRM profesional para agencias y empresas. Clientes, pipeline, facturación y soporte en un solo lugar.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-3">
          {[
            { value: '∞', label: 'Clientes' },
            { value: '24/7', label: 'Disponible' },
            { value: 'WL', label: 'White Label' },
            { value: '100%', label: 'Mobile-first' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-sm" style={{ color: 'rgba(148,163,184,0.8)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel: form ──────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12" style={{ background: '#f8fafc' }}>
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <Shield size={18} />
            </div>
            <span className="font-bold text-xl" style={{ color: '#1e293b' }}>{crmName}</span>
          </div>

          <div
            className="rounded-3xl p-8 lg:p-10"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
          >
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-1.5" style={{ color: '#1e293b' }}>Iniciar sesión</h2>
              <p className="text-sm" style={{ color: '#64748b' }}>
                Ingresá tus credenciales para continuar.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#475569' }}>Email</label>
                <input
                  name="email"
                  type="email"
                  placeholder="tu@email.com"
                  autoComplete="email"
                  required
                  className="form-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#475569' }}>Contraseña</label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="form-input pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="flex justify-end mt-1.5">
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              </div>

              {error && (
                <div
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm"
                  style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}
                >
                  <span className="shrink-0">✕</span>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}
              >
                {isPending ? (
                  <span className="w-4 h-4 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                ) : <LogIn size={16} />}
                {isPending ? 'Ingresando...' : 'Iniciar sesión'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs" style={{ color: '#94a3b8' }}>
              ¿Problemas para acceder? Contactá a tu administrador.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
