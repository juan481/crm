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
  // Ticket CSAT — public, token-gated rating link emailed to the client on
  // close (same class as /unsubscribe: no login, single purpose, self-authenticating token).
  '/valorar-ticket',
  '/api/public/ticket-rating',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Static assets — skip entirely
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/uploads') ||
    pathname === '/favicon.ico'
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
