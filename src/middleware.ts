import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_PATHS = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/setup-cliente',
  '/api/auth',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

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

  // Must be mutable so setAll can reassign it with updated cookies
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
          // Write to the request (for subsequent middleware reads)
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          // Write to the response (for the browser)
          supabaseResponse = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() also refreshes the session if needed (updates supabaseResponse cookies)
  const { data: { user } } = await supabase.auth.getUser()

  if (!isPublic && !user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
