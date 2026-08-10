import { getPluginConfig } from '@/lib/plugins'

// Dispara el webhook saliente configurado por la organización (plugin
// zapier-webhooks) para un evento del CRM. Best-effort a propósito — nunca
// debe bloquear ni revertir la operación real que lo dispara (crear un
// deal, cobrar una factura, etc.) si el webhook falla o tarda. Se llama
// siempre "fire and forget" con .catch(), nunca con await directo en el
// camino crítico de la request.
export async function fireWebhook(orgId: string, event: string, data: unknown): Promise<void> {
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
