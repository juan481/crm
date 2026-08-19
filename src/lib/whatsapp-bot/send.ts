// Envío saliente de NISSI — mismo endpoint de Meta Cloud API que
// src/lib/whatsapp.ts (botón "Enviar WhatsApp" del plugin whatsapp-integration),
// pero acá el caller ya resolvió el token/phoneNumberId (los del plugin
// whatsapp-ai-bot, potencialmente distintos) así que no vuelve a leer la
// config — evita una vuelta más a la DB por cada mensaje de una conversación
// que ya puede tener varias idas y vueltas.
interface SendResult { ok: boolean; error?: string }

export async function sendWhatsAppBotMessage(
  apiToken: string,
  phoneNumberId: string,
  toDigitsOnly: string,
  message: string,
): Promise<SendResult> {
  if (!toDigitsOnly) return { ok: false, error: 'Número de destino vacío' }
  if (!message.trim()) return { ok: false, error: 'Mensaje vacío' }

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toDigitsOnly,
        type: 'text',
        text: { body: message.trim() },
      }),
    })
    if (!res.ok) {
      const errJson = await res.json().catch(() => null) as { error?: { message?: string } } | null
      const error = errJson?.error?.message || `WhatsApp devolvió un error (HTTP ${res.status})`
      // Bug real encontrado en auditoría: esta rama no logueaba nada — sólo
      // el catch de excepción de red de abajo lo hacía. Un error HTTP de la
      // Cloud API (token vencido, ventana de 24hs de servicio al cliente
      // cerrada, número bloqueado, rate limit) quedaba completamente sin
      // rastro, aunque el caller ahora chequee `ok` (ver engine.ts) —
      // loguear acá también para que cualquier caller futuro que no lo
      // chequee no deje esto mudo.
      console.error('[NISSI SEND] WhatsApp Cloud API respondió error', { status: res.status, error, phoneNumberId })
      return { ok: false, error }
    }
    return { ok: true }
  } catch (err) {
    console.error('[NISSI SEND]', err)
    return { ok: false, error: 'Error de conexión con la API de WhatsApp' }
  }
}

/** Marca un mensaje entrante como leído (el doble check azul) — puramente
 *  cosmético para el cliente, no afecta la lógica del bot; se ignora
 *  cualquier error (no vale la pena reintentar ni loguear ruido por esto). */
export async function markWhatsAppMessageRead(
  apiToken: string,
  phoneNumberId: string,
  waMessageId: string,
): Promise<void> {
  try {
    await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: waMessageId }),
    })
  } catch {
    // best-effort, no importa si falla
  }
}
