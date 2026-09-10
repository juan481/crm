import { NextRequest, NextResponse } from 'next/server'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { sendPortalMagicLink } from '@/lib/portal-magic-link'

export const dynamic = 'force-dynamic'

// POST /api/portal/auth/request-link — el cliente pide el enlace de acceso
// desde /portal/login. Manda NUESTRO mail branded, no el de Supabase.
// Público (middleware). Responde ok aunque el email no exista (privacidad).
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const { limited } = await checkRateLimit('portal_login', ip, { max: 6, windowMinutes: 15 })
  if (limited) return NextResponse.json({ error: 'Demasiados intentos — probá de nuevo en un rato.' }, { status: 429 })

  const body = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email : ''

  const res = await sendPortalMagicLink(email, req)
  // Sólo se devuelve error si es un fallo REAL de infra (no si el email no
  // existe — eso responde ok).
  if (!res.ok && res.error) return NextResponse.json({ error: res.error }, { status: 502 })
  return NextResponse.json({ ok: true })
}
