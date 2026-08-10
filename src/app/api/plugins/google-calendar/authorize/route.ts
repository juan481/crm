import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { getPluginConfig } from '@/lib/plugins'

export const dynamic = 'force-dynamic'

const STATE_COOKIE = 'gcal_oauth_state'
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'

function pluginsUrl(req: NextRequest, param: string): string {
  return new URL(`/configuracion/plugins?gcal=${param}`, req.url).toString()
}

// Arranca el flujo OAuth de Google — sólo SUPER_ADMIN, y sólo si ya se
// cargó el Client ID (paso previo desde el modal genérico de plugins, ver
// configSchema de google-calendar). GET porque se llega acá con un click
// directo (link), no un fetch — el usuario tiene que terminar en la
// pantalla de consentimiento real de Google.
export async function GET(req: NextRequest) {
  const payload = await getCurrentUser()
  if (!payload) return NextResponse.redirect(new URL('/login', req.url))
  if (!canAccess(payload.role, 'SUPER_ADMIN')) {
    return NextResponse.redirect(pluginsUrl(req, 'forbidden'))
  }

  const config = await getPluginConfig(payload.orgId, 'google-calendar')
  const clientId = typeof config?.clientId === 'string' ? config.clientId.trim() : ''
  if (!clientId) {
    return NextResponse.redirect(pluginsUrl(req, 'not_configured'))
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    console.error('[GOOGLE CALENDAR AUTHORIZE] Falta NEXT_PUBLIC_APP_URL')
    return NextResponse.redirect(pluginsUrl(req, 'error'))
  }
  const redirectUri = `${appUrl}/api/plugins/google-calendar/callback`

  // Nonce anti-CSRF: se compara contra el que vuelve en `state` en el
  // callback, para que un tercero no pueda completar el flujo por su
  // cuenta y hacer que termine asociado a esta organización.
  const state = crypto.randomUUID()
  const cookieStore = await cookies()
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600, // 10 min, alcanza de sobra para completar el consentimiento
  })

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPE)
  authUrl.searchParams.set('access_type', 'offline') // para recibir refresh_token
  authUrl.searchParams.set('prompt', 'consent')       // fuerza refresh_token también en reconexiones
  authUrl.searchParams.set('state', state)

  return NextResponse.redirect(authUrl.toString())
}
