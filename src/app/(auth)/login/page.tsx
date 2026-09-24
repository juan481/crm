'use client'

import { Suspense, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Script from 'next/script'
import { Eye, EyeOff, LogIn, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
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
        if (window.turnstile && widgetId.current) window.turnstile.reset(widgetId.current)
        setCaptchaToken(null)
        return
      }

      // Log de acceso real en el servidor
      await fetch('/api/auth/log-login', { method: 'POST' }).catch(() => {})

      // Redirección completa a dashboard
      window.location.href = '/dashboard'
    })
  }

  return (
    <div className="min-h-screen flex bg-[#f7f9fe] text-[#181c1f] font-poppins antialiased">
      {TURNSTILE_SITE_KEY && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer onLoad={renderTurnstile} />
      )}

      {/* ── Panel Izquierdo: Presentación Limpia & Editorial (Aura Studio OS) ── */}
      <div className="hidden lg:flex lg:w-[48%] flex-col justify-between p-12 lg:p-16 bg-[#f1f4f8] border-r border-[#e0e3e7] relative overflow-hidden">
        {/* Marca Superior: Logo Grande JustCRM sin fondo */}
        <div className="flex items-center justify-between">
          <Link href="/landing" className="inline-block transition-transform hover:scale-[1.02]">
            <img src="/Logo-sin-fondo.png" alt="JustCRM Logo" className="h-11 w-auto object-contain" />
          </Link>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white text-[#00628e] border border-[#e0e3e7] shadow-sm">
            Productivity OS
          </span>
        </div>

        {/* Mensaje Editorial con trazos suaves de Poppins */}
        <div className="space-y-6 my-auto max-w-lg">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-white text-[#00628e] border border-[#e0e3e7] shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#00628e]" />
            <span>Sistema Operativo de Gestión & Servicios Técnicos</span>
          </div>

          <h1 className="text-3xl lg:text-4xl font-semibold text-[#181c1f] leading-snug tracking-[-0.02em]">
            Gestioná tu negocio con la calma y precisión de una plataforma integral.
          </h1>

          <p className="text-[#40484f] text-sm leading-relaxed font-normal">
            Conectá tus ventas, pañol y cuadrillas técnicas en un solo ecosistema. Cotizá en 30s con listas duales, controlá stock físico y despachá órdenes con firma digital en vivo.
          </p>

          {/* Tarjetas de Métricas: Suaves, táctiles y limpias */}
          <div className="grid grid-cols-2 gap-3.5 pt-2">
            {[
              { val: '2 Seg', label: 'Bot WhatsApp IA', sub: 'Atención 24/7 sin demoras', tagColor: '#00628e' },
              { val: '30 Seg', label: 'Cotizador Flash', sub: 'Gremio & Público en PDF', tagColor: '#076490' },
              { val: 'Stock & Pañol', label: 'Conteo Físico', sub: 'Carga activa sin facturas', tagColor: '#5f5e5e' },
              { val: "App 'Mi Día'", label: 'Cuadrillas en Calle', sub: 'GPS, checklist y remitos', tagColor: '#00496b' },
            ].map((m) => (
              <div
                key={m.label}
                className="bg-white rounded-2xl p-4 border border-[#e0e3e7] shadow-sm transition-all hover:border-[#00628e]/40 hover:shadow-md"
              >
                <p className="text-lg font-semibold" style={{ color: m.tagColor }}>{m.val}</p>
                <p className="text-xs font-semibold text-[#181c1f] mt-0.5">{m.label}</p>
                <p className="text-[11px] text-[#5f5e5e] font-normal">{m.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer del Panel Izquierdo: Logo Just Create */}
        <div className="flex items-center justify-between pt-6 border-t border-[#e0e3e7]">
          <Link
            href="/landing"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#40484f] hover:text-[#00628e] transition-colors"
          >
            <span>← Volver a la página principal</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#707880]">powered by</span>
            <img src="/just-create-logo.png" alt="Just Create" className="h-6 w-auto object-contain" />
          </div>
        </div>
      </div>

      {/* ── Panel Derecho: Formulario de Acceso Blanco Puro ─────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-[#f7f9fe]">
        <div className="w-full max-w-[440px]">
          
          {/* Logo móvil */}
          <div className="lg:hidden flex items-center justify-between mb-8">
            <Link href="/landing">
              <img src="/Logo-sin-fondo.png" alt="JustCRM Logo" className="h-9 w-auto object-contain" />
            </Link>
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white text-[#00628e] border border-[#e0e3e7]">
              Productivity OS
            </span>
          </div>

          {/* Tarjeta de Inicio de Sesión */}
          <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#e0e3e7] shadow-sm">
            <div className="mb-7">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-[#00628e]" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#00628e]">
                  Acceso Seguro
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-semibold text-[#181c1f] tracking-tight">
                Iniciar sesión
              </h2>
              <p className="text-xs sm:text-sm text-[#5f5e5e] font-normal mt-1">
                Ingresá tus credenciales para acceder a tu panel de control.
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
                  className="w-full bg-[#f8fafc] border border-[#e0e3e7] focus:border-[#00628e] focus:bg-white focus:ring-2 focus:ring-[#00628e]/15 text-[#181c1f] placeholder-[#707880] rounded-xl px-4 py-3 text-sm outline-none transition-all font-normal"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#40484f]">
                    Contraseña
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-[#00628e] hover:underline transition-colors"
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
                    className="w-full bg-[#f8fafc] border border-[#e0e3e7] focus:border-[#00628e] focus:bg-white focus:ring-2 focus:ring-[#00628e]/15 text-[#181c1f] placeholder-[#707880] rounded-xl px-4 py-3 pr-11 text-sm outline-none transition-all font-normal"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#707880] hover:text-[#181c1f] transition-colors"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {suspended && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-medium bg-[#ffdad6] border border-[#ba1a1a]/20 text-[#93000a]">
                  Cuenta suspendida, contactá a contacto@justcreate.com.ar
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-medium bg-[#ffdad6] border border-[#ba1a1a]/20 text-[#93000a]">
                  <span className="shrink-0 font-semibold">✕</span>
                  <span>{error}</span>
                </div>
              )}

              {TURNSTILE_SITE_KEY && <div ref={turnstileEl} className="flex justify-center" />}

              <button
                type="submit"
                disabled={isPending || (!!TURNSTILE_SITE_KEY && !captchaToken)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full font-medium text-sm text-white bg-[#00628e] hover:bg-[#00496b] transition-all transform hover:-translate-y-0.5 disabled:opacity-60 cursor-pointer shadow-md shadow-[#00628e]/25 mt-2"
              >
                {isPending ? (
                  <span className="w-4 h-4 border-2 rounded-full animate-spin border-white/30 border-t-white" />
                ) : (
                  <LogIn size={16} />
                )}
                <span>{isPending ? 'Ingresando al sistema...' : 'Iniciar sesión'}</span>
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-[#e0e3e7] text-center space-y-3">
              <p className="text-xs text-[#707880] font-normal">
                ¿Problemas para acceder? Contactá a tu administrador.
              </p>
              <div className="flex items-center justify-center gap-1.5 text-xs">
                <span className="text-[#5f5e5e] font-normal">¿Aún no tenés JustCRM?</span>
                <Link
                  href="/landing#contacto"
                  className="font-medium text-[#00628e] hover:underline"
                >
                  Solicitá una demo aquí
                </Link>
              </div>
            </div>

            {/* Logo de Just Create en el pie del login */}
            <div className="mt-6 pt-5 flex items-center justify-center gap-2 border-t border-[#f1f4f8]">
              <span className="text-[11px] text-[#707880] font-normal">developed by</span>
              <img src="/just-create-logo.png" alt="Just Create" className="h-5 w-auto object-contain" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
