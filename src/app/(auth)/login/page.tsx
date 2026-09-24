'use client'

import { Suspense, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Script from 'next/script'
import { Eye, EyeOff, LogIn, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useThemeStore } from '@/store/theme-store'

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string
      reset:  (widgetId: string) => void
    }
  }
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

// Color corporativo oficial extraído del logo: hsl(197.07deg 95.35% 25.29%) = #035b7e
const BRAND_PRIMARY = 'hsl(197.07deg 95.35% 25.29%)'
const BRAND_ACCENT  = '#05a3e1'
const BRAND_CYAN    = '#06b4f9'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const suspended = searchParams.get('suspended') === '1'
  const { crmName } = useThemeStore()
  const [showPass, setShowPass] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const turnstileEl  = useRef<HTMLDivElement>(null)
  const widgetId      = useRef<string | null>(null)
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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd       = new FormData(e.currentTarget)
    const email    = (fd.get('email')    as string).trim()
    const password = fd.get('password') as string

    if (!email || !password) { setError('Completá todos los campos.'); return }
    if (TURNSTILE_SITE_KEY && !captchaToken) { setError('Completá la verificación de seguridad.'); return }

    startTransition(async () => {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email, password,
        ...(captchaToken ? { options: { captchaToken } } : {}),
      })

      if (authError) {
        setError(
          authError.message === 'Invalid login credentials'
            ? 'Email o contraseña incorrectos.'
            : authError.message
        )
        // Turnstile tokens are single-use — reset the widget so the user can retry
        if (window.turnstile && widgetId.current) window.turnstile.reset(widgetId.current)
        setCaptchaToken(null)
        return
      }

      // Log de acceso real — server-side, no se puede falsear
      await fetch('/api/auth/log-login', { method: 'POST' }).catch(() => {})

      // Full page reload so the middleware and Server Components read the new session
      window.location.href = '/dashboard'
    })
  }

  return (
    <div className="min-h-screen flex bg-[#070b14] text-slate-100 font-poppins relative overflow-hidden">
      {TURNSTILE_SITE_KEY && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer onLoad={renderTurnstile} />
      )}

      {/* ── Glows ambientales usando el color corporativo hsl(197.07, 95.35%, 25.29%) ── */}
      <div
        className="absolute top-0 left-0 w-[550px] h-[550px] rounded-full blur-[140px] pointer-events-none opacity-40"
        style={{ background: 'radial-gradient(circle, hsl(197.07deg 95.35% 25.29%), transparent 70%)' }}
      />
      <div
        className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full blur-[150px] pointer-events-none opacity-25"
        style={{ background: 'radial-gradient(circle, #05a3e1, transparent 70%)' }}
      />
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* ── Left panel: Presentación Corporativa JustCRM ─────────────────── */}
      <div
        className="hidden lg:flex lg:w-[46%] flex-col justify-between p-12 lg:p-16 relative z-10 border-r border-slate-800/80"
        style={{ background: 'linear-gradient(180deg, rgba(7,14,26,0.85) 0%, rgba(5,11,20,0.95) 100%)' }}
      >
        {/* Logo Superior */}
        <div className="flex items-center gap-3.5">
          <div
            className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-900 border p-1 flex items-center justify-center shrink-0 shadow-lg"
            style={{ borderColor: 'rgba(5, 163, 225, 0.35)', boxShadow: '0 8px 24px rgba(3, 91, 126, 0.3)' }}
          >
            <img src="/app-icon.png" alt="JustCRM Icon" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-white">JustCRM</span>
              <span
                className="text-[10px] font-bold px-2.5 py-0.5 rounded-full text-cyan-300 border"
                style={{ background: 'rgba(3, 91, 126, 0.35)', borderColor: 'rgba(5, 163, 225, 0.4)' }}
              >
                Productivity OS
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">by JustCreate</p>
          </div>
        </div>

        {/* Propuesta de valor central */}
        <div className="space-y-5 my-auto max-w-lg">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md"
            style={{
              background: 'rgba(3, 91, 126, 0.25)',
              borderColor: 'rgba(5, 163, 225, 0.35)',
              color: '#38bdf8',
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sistema Operativo de Gestión & Servicios Técnicos</span>
          </div>

          <h1 className="text-4xl lg:text-5xl font-black text-white leading-[1.1] tracking-tight">
            Gestioná tu negocio de forma{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #38bdf8 0%, #05a3e1 50%, #ffffff 100%)' }}
            >
              inteligente.
            </span>
          </h1>

          <p className="text-slate-300 text-sm leading-relaxed">
            Plataforma integral para empresas de seguridad electrónica, telecomunicaciones e instaladores técnicos. Cotizá en 30s, controlá tu pañol y despachá cuadrillas con firma digital.
          </p>

          {/* Grid de Métricas */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {[
              { title: '2 Segundos', label: 'Bot WhatsApp IA', desc: 'Atención 24/7 sin demoras', color: '#10b981' },
              { title: '30 Segundos', label: 'Cotizador Flash', desc: 'Gremio & Público en PDF', color: '#06b4f9' },
              { title: 'Stock & Pañol', label: 'Conteo Físico', desc: 'Carga activa sin facturas', color: '#f59e0b' },
              { title: "App 'Mi Día'", label: 'Cuadrillas Técnicas', desc: 'GPS, checklist y fotos', color: '#38bdf8' },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-2xl p-4 border backdrop-blur-md transition-all hover:border-cyan-500/40"
                style={{ background: 'rgba(15, 23, 42, 0.65)', borderColor: 'rgba(255, 255, 255, 0.08)' }}
              >
                <p className="text-xl font-black" style={{ color: m.color }}>{m.title}</p>
                <p className="text-xs font-bold text-white mt-0.5">{m.label}</p>
                <p className="text-[11px] text-slate-400">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer del panel izquierdo */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-800/80">
          <Link
            href="/landing"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            <span>← Volver a JustCRM Landing</span>
          </Link>
          <JustCreateCredit tone="dark" />
        </div>
      </div>

      {/* ── Right panel: Formulario de Login ────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative z-10">
        <div className="w-full max-w-[440px]">
          
          {/* Header Móvil */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div
              className="w-11 h-11 rounded-2xl overflow-hidden bg-slate-900 border p-1 flex items-center justify-center shadow-lg"
              style={{ borderColor: 'rgba(5, 163, 225, 0.35)', boxShadow: '0 4px 16px rgba(3, 91, 126, 0.3)' }}
            >
              <img src="/app-icon.png" alt="JustCRM Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-black text-xl text-white flex items-center gap-2">
                JustCRM <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">Productivity OS</span>
              </span>
              <p className="text-[10px] text-slate-400 font-medium">by JustCreate</p>
            </div>
          </div>

          {/* Tarjeta de Inicio de Sesión */}
          <div
            className="rounded-3xl p-8 sm:p-10 border backdrop-blur-2xl shadow-2xl relative"
            style={{
              background: 'linear-gradient(180deg, rgba(13, 22, 38, 0.92) 0%, rgba(7, 13, 24, 0.96) 100%)',
              borderColor: 'rgba(5, 163, 225, 0.25)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(3, 91, 126, 0.2)',
            }}
          >
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">Acceso Seguro</span>
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight">Iniciar sesión</h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Ingresá tus credenciales para acceder al CRM.
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

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Contraseña
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    required
                    className="w-full bg-[#070e1a] border border-slate-700/80 focus:border-[#05a3e1] focus:ring-2 focus:ring-[#05a3e1]/25 text-white placeholder-slate-500 rounded-xl px-4 py-3.5 pr-12 text-sm outline-none transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {suspended && (
                <div
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-medium border"
                  style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24' }}
                >
                  Cuenta suspendida, contactá a contacto@justcreate.com.ar
                </div>
              )}

              {error && (
                <div
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-medium border"
                  style={{ background: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171' }}
                >
                  <span className="shrink-0 font-bold">✕</span>
                  <span>{error}</span>
                </div>
              )}

              {TURNSTILE_SITE_KEY && <div ref={turnstileEl} className="flex justify-center" />}

              <button
                type="submit"
                disabled={isPending || (!!TURNSTILE_SITE_KEY && !captchaToken)}
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
                  <LogIn size={18} />
                )}
                <span>{isPending ? 'Ingresando al sistema...' : 'Iniciar sesión'}</span>
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-800 text-center space-y-3">
              <p className="text-xs text-slate-400">
                ¿Problemas para acceder? Contactá a tu administrador.
              </p>
              <div className="flex items-center justify-center gap-2 text-xs">
                <span className="text-slate-400">¿Aún no tenés JustCRM?</span>
                <Link
                  href="/landing#contacto"
                  className="font-bold text-cyan-400 hover:text-cyan-300 underline transition-colors"
                >
                  Solicitá tu demo aquí
                </Link>
              </div>
            </div>

            <div className="mt-6 pt-4 flex justify-center border-t border-slate-800/60">
              <JustCreateCredit tone="dark" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function JustCreateCredit({ tone }: { tone: 'dark' | 'light' }) {
  const muted = tone === 'dark' ? 'rgba(148,163,184,0.75)' : '#94a3b8'
  const strong = tone === 'dark' ? '#ffffff' : '#334155'
  return (
    <a
      href="https://justcreate.com.ar"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80"
      style={{ color: muted }}
    >
      <span>by</span>
      <span className="inline-flex items-center gap-1 font-bold" style={{ color: strong }}>
        <span
          className="w-4 h-4 rounded-[5px] flex items-center justify-center text-[9px] font-black text-white"
          style={{ background: 'linear-gradient(135deg, hsl(197.07deg 95.35% 25.29%), #05a3e1)' }}
        >
          J
        </span>
        JustCreate
      </span>
    </a>
  )
}
