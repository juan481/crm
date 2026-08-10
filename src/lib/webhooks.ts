import { waitUntil } from '@vercel/functions'
import { getPluginConfig } from '@/lib/plugins'

async function doFireWebhook(orgId: string, event: string, data: unknown): Promise<void> {
  try {
    const config = await getPluginConfig(orgId, 'zapier-webhooks')
    const url = typeof config?.webhookUrl === 'string' ? config.webhookUrl.trim() : ''
    if (!url) return // plugin apagado, o activado sin URL cargada todavía

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, data, timestamp: new Date().toISOString() }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
  } catch (err) {
    console.error('[WEBHOOK]', event, err)
  }
}

// Dispara el webhook saliente configurado por la organización (plugin
// zapier-webhooks) para un evento del CRM. Best-effort a propósito — nunca
// debe bloquear ni revertir la operación real que lo dispara (crear un
// deal, cobrar una factura, etc.) si el webhook falla o tarda.
//
// waitUntil (no un simple "fire and forget" con .catch()) porque en
// funciones serverless de Vercel una promesa no esperada puede cortarse a
// mitad de camino apenas se manda la respuesta — sin esto, el webhook
// podía fallar en silencio de forma intermitente, sin ningún error visible
// (el fetch nunca llegaba a completarse). waitUntil le dice al runtime que
// mantenga la función viva hasta que esta promesa termine, sin retrasar la
// respuesta al usuario.
export function fireWebhook(orgId: string, event: string, data: unknown): void {
  waitUntil(doFireWebhook(orgId, event, data))
}
