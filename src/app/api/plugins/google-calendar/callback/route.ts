import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { getPluginConfig } from '@/lib/plugins'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const STATE_COOKIE = 'gcal_oauth_state'

function pluginsUrl(req: NextRequest, param: string): string {
  return new URL(`/configuracion/plugins?gcal=${param}`, req.url).toString()
}

// Vuelta del consentimiento de Google — intercambia el code por
// access_token/refresh_token y los guarda para la organización. Esta URL
// tiene que estar registrada tal cual (mismo NEXT_PUBLIC_APP_URL) como
// "Authorized redirect URI" en el proyecto de Google Cloud de cada
// organización que use este plugin.
export async function GET(req: NextRequest) {
  const payload = await getCurrentUser()
  if (!payload) return NextResponse.redirect(new URL('/login', req.url))
  if (!canAccess(payload.role, 'SUPER_ADMIN')) {
    return NextResponse.redirect(pluginsUrl(req, 'forbidden'))
  }

  const { searchParams } = req.nextUrl
  if (searchParams.get('error')) {
    // El usuario canceló o rechazó el consentimiento — no es un error real.
    return NextResponse.redirect(pluginsUrl(req, 'denied'))
  }

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const cookieStore = await cookies()
  const expectedState = cookieStore.get(STATE_COOKIE)?.value
  cookieStore.delete(STATE_COOKIE)

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(pluginsUrl(req, 'error'))
  }

  const config = await getPluginConfig(payload.orgId, 'google-calendar')
  const clientId = typeof config?.clientId === 'string' ? config.clientId.trim() : ''
  const clientSecret = typeof config?.clientSecret === 'string' ? config.clientSecret.trim() : ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!clientId || !clientSecret || !appUrl) {
    return NextResponse.redirect(pluginsUrl(req, 'not_configured'))
  }
  const redirectUri = `${appUrl}/api/plugins/google-calendar/callback`

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenRes.ok) {
      const errBody = await tokenRes.text().catch(() => '')
      console.error('[GOOGLE CALENDAR CALLBACK] token exchange falló', tokenRes.status, errBody)
      return NextResponse.redirect(pluginsUrl(req, 'error'))
    }
    const tokenJson = await tokenRes.json()
    if (!tokenJson.refresh_token) {
      // No debería pasar con access_type=offline&prompt=consent, pero si
      // pasa (ej. Google cambia de idea algún día) no hay forma de
      // refrescar más adelante — mejor avisar que guardar algo inútil.
      console.error('[GOOGLE CALENDAR CALLBACK] Google no devolvió refresh_token')
      return NextResponse.redirect(pluginsUrl(req, 'error'))
    }

    const db = prisma as any
    await db.googleCalendarConnection.upsert({
      where: { organizationId: payload.orgId },
      update: {
        connectedById: payload.userId,
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token,
        expiresAt: new Date(Date.now() + (tokenJson.expires_in ?? 3600) * 1000),
      },
      create: {
        organizationId: payload.orgId,
        connectedById: payload.userId,
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token,
        expiresAt: new Date(Date.now() + (tokenJson.expires_in ?? 3600) * 1000),
      },
    })

    return NextResponse.redirect(pluginsUrl(req, 'connected'))
  } catch (err) {
    console.error('[GOOGLE CALENDAR CALLBACK]', err)
    return NextResponse.redirect(pluginsUrl(req, 'error'))
  }
}
