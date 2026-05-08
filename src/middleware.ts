import { NextRequest, NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth-edge'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow Next.js internals and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/uploads') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Allow all /api/auth/* routes without token check
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
  const payload = await getAuthPayload(req)

  // Unauthenticated user trying to access protected route
  if (!isPublic && !payload) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Authenticated user trying to access login page
  if (isPublic && payload && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
