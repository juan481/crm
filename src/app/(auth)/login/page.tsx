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
    <div className="min-h-screen flex bg-[#070b14] text-[#181c1f] font-poppins antialiased">
      {TURNSTILE_SITE_KEY && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer onLoad={renderTurnstile} />
      )}

      {/* ── Panel Izquierdo (Parte Negra & Animada): Presentación Editorial con Fondo de Amor & JustCRM Grande ── */}
      <div className="hidden lg:flex lg:w-[50%] flex-col justify-between p-12 lg:p-16 bg-[#070b14] border-r border-slate-800/80 relative overflow-hidden text-white">
        
        {/* Capa de textura de rejilla sutil para profundidad técnica */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(56,189,248,0.12)_1px,transparent_1px)] [background-size:28px_28px] opacity-40 pointer-events-none" />

        {/* Orbes de luz ambiental animados ("amor al fondo") */}
        <div className="absolute -top-28 -left-28 w-[520px] h-[520px] rounded-full bg-gradient-to-tr from-[#00496b]/40 via-[#00628e]/30 to-cyan-500/20 blur-[130px] pointer-events-none animate-pulse-glow" />
        <div className="absolute -bottom-28 -right-28 w-[480px] h-[480px] rounded-full bg-gradient-to-bl from-indigo-900/35 via-[#00496b]/25 to-cyan-400/20 blur-[120px] pointer-events-none animate-landing-float" />
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[320px] h-[320px] rounded-full bg-cyan-400/10 blur-[100px] pointer-events-none" />

        {/* Mensaje Editorial con trazos finos y elegantes de Poppins */}
        <div className="space-y-6 my-auto max-w-lg relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-slate-900/90 text-cyan-300 border border-slate-700/80 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sistema Operativo de Gestión & Servicios Técnicos</span>
          </div>

          <h1 className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-white leading-tight tracking-tight">
            Gestioná tu negocio con la <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-sky-200 to-white">calma y precisión</span> de una plataforma integral.
          </h1>

          <p className="text-slate-300 text-sm leading-relaxed font-normal">
            Conectá tus ventas, operaciones y equipos en un solo ecosistema. Cotizá en 30s con listas duales, automatizá procesos y gestioná permisos de usuarios con máxima seguridad.
          </p>

          {/* Tarjetas de Métricas: Glassmorphism oscuro con micro-bordes */}
          <div className="grid grid-cols-2 gap-3.5 pt-2">
            {[
              { val: '2 Seg', label: 'Bot WhatsApp IA', sub: 'Atención 24/7 sin demoras', tagColor: '#38bdf8' },
              { val: '30 Seg', label: 'Cotizador Flash', sub: 'Gremio & Público en PDF', tagColor: '#0ea5e9' },
              { val: 'Automatización', label: 'Mejora tu productividad', sub: 'Automatiza procesos · Centraliza toda tu gestión', tagColor: '#34d399' },
              { val: 'Multi-Rol', label: 'Usuarios y Privilegios', sub: 'Permisos granulares por área y jerarquía', tagColor: '#818cf8' },
            ].map((m) => (
              <div
                key={m.label}
                className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-slate-800/80 shadow-lg transition-all hover:border-cyan-400/40 hover:bg-slate-900/80 hover:-translate-y-0.5 group flex flex-col justify-between"
              >
                <div>
                  <p className="text-base sm:text-lg font-semibold tracking-tight" style={{ color: m.tagColor }}>{m.val}</p>
                  <p className="text-xs font-semibold text-white mt-1 leading-snug">{m.label}</p>
                </div>
                <p className="text-[11px] text-slate-400 font-normal mt-1 leading-relaxed">{m.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer del Panel Izquierdo: Solo navegación limpia sin duplicar Just Create */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-800/80 relative z-10">
          <Link
            href="/landing"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            <span>← Volver a la página principal</span>
          </Link>
          <span className="text-xs text-slate-500">© 2026 JustCRM</span>
        </div>
      </div>

      {/* ── Panel Derecho (Parte Gris & Clara): Canvas arquitectónico con Tarjeta Blanca Flotante ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-gradient-to-br from-[#f1f4f8] via-[#e8edf4] to-[#dfe5ed] relative overflow-hidden">
        
        {/* Resplandor ambiental suave en el fondo gris */}
        <div className="absolute w-[500px] h-[500px] rounded-full bg-white/70 blur-[90px] pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] rounded-full bg-[#00628e]/10 blur-[80px] pointer-events-none" />

        <div className="w-full max-w-[440px] relative z-10">
          
          {/* Tarjeta de Inicio de Sesión (Parte Clara / Blanca Pura) */}
          <div className="bg-white rounded-[28px] p-8 sm:p-10 border border-[#d6dde5] shadow-[0_20px_50px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] relative z-10">
            
            {/* Logo de JustCRM arriba del login con colores originales sobre fondo blanco */}
            <div className="flex items-center justify-center mb-6 pb-2">
              <Link href="/landing" className="inline-block transition-transform hover:scale-[1.02]">
                <img
                  src="/Logo-sin-fondo.png"
                  alt="JustCRM"
                  className="h-14 sm:h-16 w-auto object-contain"
                />
              </Link>
            </div>

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
                  className="w-full bg-[#f8fafc] border border-[#d6dde5] focus:border-[#00628e] focus:bg-white focus:ring-2 focus:ring-[#00628e]/15 text-[#181c1f] placeholder-[#707880] rounded-xl px-4 py-3 text-sm outline-none transition-all font-normal"
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
                    className="w-full bg-[#f8fafc] border border-[#d6dde5] focus:border-[#00628e] focus:bg-white focus:ring-2 focus:ring-[#00628e]/15 text-[#181c1f] placeholder-[#707880] rounded-xl px-4 py-3 pr-11 text-sm outline-none transition-all font-normal"
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
            <div className="mt-6 pt-5 flex items-center justify-center border-t border-[#f1f4f8]">
              <a
                href="https://justcreate.com.ar"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[11px] text-[#707880] hover:text-[#00628e] transition-colors group"
              >
                <span className="font-normal">developed by</span>
                <img
                  src="/just-create-logo.png"
                  alt="Just Create"
                  className="h-5 w-auto object-contain transition-transform group-hover:scale-105"
                />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
