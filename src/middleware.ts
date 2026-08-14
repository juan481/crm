import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_PATHS = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/setup-cliente',
  '/api/auth',
  '/unsubscribe',
  '/api/track/open',
  // Webhooks are called by external, unauthenticated callers (a website form,
  // Amazon SNS) and authenticate themselves (per-event secret / SNS signature)
  // instead of a Supabase session — must stay reachable past this middleware.
  '/api/webhooks',
  // Vercel Cron triggers these directly — no Supabase session, ever. Same
  // class as /api/webhooks: self-authenticates via CRON_SECRET inside the
  // route (src/lib/cron-auth.ts), not via this middleware. Without this
  // entry, every cron invocation was silently redirected to /login (307)
  // before ever reaching the route handler — found in prod after Fase 10-13
  // shipped, fixed here.
  '/api/cron',
  // Ticket CSAT — public, token-gated rating link emailed to the client on
  // close (same class as /unsubscribe: no login, single purpose, self-authenticating token).
  '/valorar-ticket',
  '/api/public/ticket-rating',
  // Formulario público de autogestión de tickets (Fase 13) — mismo criterio
  // que /valorar-ticket: sin login, token-gated (Organization.publicSupportToken).
  '/soporte',
  '/api/public/tickets',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Static assets — skip entirely. Manifest/service worker/íconos deben ser
  // alcanzables SIN sesión: el navegador puede pedirlos estando todavía en
  // /login (para el prompt de "instalar app"), y si el middleware los
  // redirige a /login, el browser recibe el HTML del login en vez del JS/
  // JSON esperado — el registro del service worker fallaría en ese caso
  // límite. Encontrado en revisión propia antes de que llegara a pasar en
  // producción.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/uploads') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname.startsWith('/icons/')
  ) {
    return NextResponse.next()
  }

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )

  // Public paths: serve immediately — no Supabase call, no redirect possible
  // This is the key guard against redirect loops on /login
  if (isPublic) return NextResponse.next()

  // Protected paths: check auth via Supabase
  let supabaseResponse = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Supabase unavailable or env vars missing — treat as unauthenticated
  }

  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
