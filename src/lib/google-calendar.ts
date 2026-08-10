import { prisma } from '@/lib/db'
import { getPluginConfig } from '@/lib/plugins'

// Devuelve un access_token vigente para la organización, refrescándolo con
// el refresh_token guardado si ya venció (con 60s de margen). null si la
// org nunca conectó Google Calendar o si el refresh falla (credenciales
// revocadas del lado de Google, por ejemplo).
async function getValidAccessToken(orgId: string): Promise<string | null> {
  const db = prisma as any
  const conn = await db.googleCalendarConnection.findUnique({ where: { organizationId: orgId } })
  if (!conn) return null

  if (conn.expiresAt.getTime() > Date.now() + 60_000) return conn.accessToken

  const config = await getPluginConfig(orgId, 'google-calendar')
  const clientId = typeof config?.clientId === 'string' ? config.clientId.trim() : ''
  const clientSecret = typeof config?.clientSecret === 'string' ? config.clientSecret.trim() : ''
  if (!clientId || !clientSecret) return null

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
    if (!res.ok) return null
    const json = await res.json()
    const accessToken = json.access_token as string
    const expiresAt = new Date(Date.now() + (json.expires_in ?? 3600) * 1000)
    await db.googleCalendarConnection.update({ where: { organizationId: orgId }, data: { accessToken, expiresAt } })
    return accessToken
  } catch (err) {
    console.error('[GOOGLE CALENDAR] refresh falló', err)
    return null
  }
}

interface PushEventInput { title: string; description?: string | null; start: Date; end: Date }
interface PushEventResult { ok: boolean; error?: string; eventUrl?: string }

// Crea un evento en el calendario "primary" de la cuenta de Google
// conectada por la organización. No hace update/delete si ya se sincronizó
// antes (fuera de alcance de esta primera versión — sincronización manual,
// un botón, sin mantener un vínculo bidireccional persistente).
export async function pushEventToGoogleCalendar(orgId: string, event: PushEventInput): Promise<PushEventResult> {
  const token = await getValidAccessToken(orgId)
  if (!token) return { ok: false, error: 'Google Calendar no está conectado para esta organización' }

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
