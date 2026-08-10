import { prisma } from '@/lib/db'
import { getPluginConfig } from '@/lib/plugins'

type TokenResult =
  | { ok: true; accessToken: string }
  // 'not_connected': la org nunca hizo el flujo OAuth. 'refresh_failed':
  // sí lo conectó alguna vez, pero el refresh_token dejó de servir (Google
  // lo revocó, o alguien borró el clientSecret de la config) — mensajes de
  // error distintos a propósito, "no está conectado" sería confuso para
  // alguien que sabe que sí lo conectó.
  | { ok: false; reason: 'not_connected' | 'refresh_failed' }

// Devuelve un access_token vigente para la organización, refrescándolo con
// el refresh_token guardado si ya venció (con 60s de margen).
async function getValidAccessToken(orgId: string): Promise<TokenResult> {
  const db = prisma as any
  const conn = await db.googleCalendarConnection.findUnique({ where: { organizationId: orgId } })
  if (!conn) return { ok: false, reason: 'not_connected' }

  if (conn.expiresAt.getTime() > Date.now() + 60_000) return { ok: true, accessToken: conn.accessToken }

  const config = await getPluginConfig(orgId, 'google-calendar')
  const clientId = typeof config?.clientId === 'string' ? config.clientId.trim() : ''
  const clientSecret = typeof config?.clientSecret === 'string' ? config.clientSecret.trim() : ''
  if (!clientId || !clientSecret) return { ok: false, reason: 'refresh_failed' }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: conn.refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    if (!res.ok) return { ok: false, reason: 'refresh_failed' }
    const json = await res.json()
    const accessToken = json.access_token as string
    const expiresAt = new Date(Date.now() + (json.expires_in ?? 3600) * 1000)
    await db.googleCalendarConnection.update({ where: { organizationId: orgId }, data: { accessToken, expiresAt } })
    return { ok: true, accessToken }
  } catch (err) {
    console.error('[GOOGLE CALENDAR] refresh falló', err)
    return { ok: false, reason: 'refresh_failed' }
  }
}

interface PushEventInput { title: string; description?: string | null; start: Date; end: Date }
interface PushEventResult { ok: boolean; error?: string; eventUrl?: string }

// Crea un evento en el calendario "primary" de la cuenta de Google
// conectada por la organización. No hace update/delete si ya se sincronizó
// antes (fuera de alcance de esta primera versión — sincronización manual,
// un botón, sin mantener un vínculo bidireccional persistente).
export async function pushEventToGoogleCalendar(orgId: string, event: PushEventInput): Promise<PushEventResult> {
  const tokenResult = await getValidAccessToken(orgId)
  if (!tokenResult.ok) {
    return {
      ok: false,
      error: tokenResult.reason === 'not_connected'
        ? 'Google Calendar no está conectado para esta organización — conectalo desde Plugins'
        : 'La conexión con Google Calendar venció o fue revocada — reconectala desde Plugins',
    }
  }
  const token = tokenResult.accessToken

  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: event.title,
        description: event.description || undefined,
        start: { dateTime: event.start.toISOString() },
        end: { dateTime: event.end.toISOString() },
      }),
    })
    if (!res.ok) {
      const errJson = await res.json().catch(() => null) as { error?: { message?: string } } | null
      return { ok: false, error: errJson?.error?.message || `Google Calendar devolvió un error (HTTP ${res.status})` }
    }
    const json = await res.json()
    return { ok: true, eventUrl: json.htmlLink }
  } catch (err) {
    console.error('[GOOGLE CALENDAR] push falló', err)
    return { ok: false, error: 'Error de conexión con Google Calendar' }
  }
}
