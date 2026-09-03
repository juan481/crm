// Envío saliente de NISSI — mismo endpoint de Meta Cloud API que
// src/lib/whatsapp.ts (botón "Enviar WhatsApp" del plugin whatsapp-integration),
// pero acá el caller ya resolvió el token/phoneNumberId (los del plugin
// whatsapp-ai-bot, potencialmente distintos) así que no vuelve a leer la
// config — evita una vuelta más a la DB por cada mensaje de una conversación
// que ya puede tener varias idas y vueltas.
interface SendResult { ok: boolean; error?: string; messageId?: string }

// El wa_id que Meta manda en el webhook trae, para algunos países, un dígito
// que hay que SACAR al enviar (Meta entrega igual al mismo WhatsApp):
//  - Argentina: 549 + 10 dígitos  ->  54 + 10   (el "9" de celular)
//  - México:    521 + 10 dígitos  ->  52 + 10   (el "1")
// Con el dígito de más, la Cloud API rebota #131030 ("Recipient phone number
// not in allowed list") en modo prueba y puede fallar en producción.
export function normalizeWhatsAppTo(digits: string): string {
  if (/^549\d{10}$/.test(digits)) return '54' + digits.slice(3)
  if (/^521\d{10}$/.test(digits)) return '52' + digits.slice(3)
  return digits
}

export async function sendWhatsAppBotMessage(
  apiToken: string,
  phoneNumberId: string,
  toDigitsOnly: string,
  message: string,
): Promise<SendResult> {
  if (!toDigitsOnly) return { ok: false, error: 'Número de destino vacío' }
  if (!message.trim()) return { ok: false, error: 'Mensaje vacío' }

  const to = normalizeWhatsAppTo(toDigitsOnly)

  try {
    const res = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message.trim() },
      }),
    })
    const json = await res.json().catch(() => null) as
      | { messages?: { id?: string }[]; error?: { message?: string } }
      | null
    if (!res.ok) {
      const error = json?.error?.message || `WhatsApp devolvió un error (HTTP ${res.status})`
      // Bug real encontrado en auditoría: esta rama no logueaba nada — sólo
      // el catch de excepción de red de abajo lo hacía. Un error HTTP de la
      // Cloud API (token vencido, ventana de 24hs de servicio al cliente
      // cerrada, número bloqueado, rate limit) quedaba completamente sin
      // rastro, aunque el caller ahora chequee `ok` (ver engine.ts) —
      // loguear acá también para que cualquier caller futuro que no lo
      // chequee no deje esto mudo.
      console.error('[NISSI SEND] WhatsApp Cloud API respondió error', { status: res.status, error, phoneNumberId, to })
      return { ok: false, error }
    }
    return { ok: true, messageId: json?.messages?.[0]?.id }
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
    await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: waMessageId }),
    })
  } catch {
    // best-effort, no importa si falla
  }
}
