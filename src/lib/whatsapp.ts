import { getPluginConfig } from '@/lib/plugins'
import { normalizeWhatsAppTo } from '@/lib/whatsapp-bot/send'

interface SendResult { ok: boolean; error?: string }

// Envío server-side vía WhatsApp Cloud API (Meta) para el botón "Enviar
// WhatsApp" de la ficha de contacto. Reutiliza las credenciales del plugin
// NISSI (whatsapp-ai-bot) — antes había un plugin aparte (whatsapp-integration)
// que se quitó para no tener dos configuraciones de lo mismo. Sin token +
// phoneNumberId cargados en NISSI, el endpoint que llama a esto devuelve un
// error claro en vez de intentar mandar nada.
//
// LIMITACIÓN CONOCIDA (API de Meta, no de este código): un número de
// WhatsApp Business sólo puede mandar mensajes de texto libres dentro de
// las 24hs desde el último mensaje que ESE contacto le mandó a la
// empresa — fuera de esa ventana, Meta exige un "template" pre-aprobado
// en Meta Business Manager en vez de texto libre, y esta primera versión
// no lo soporta. Si el envío falla por eso, Meta lo devuelve como error
// específico y se lo pasamos tal cual al usuario.
export async function sendWhatsAppMessage(orgId: string, to: string, message: string): Promise<SendResult> {
  const config = await getPluginConfig(orgId, 'whatsapp-ai-bot')
  const apiToken = typeof config?.apiToken === 'string' ? config.apiToken.trim() : ''
  const phoneNumberId = typeof config?.phoneNumberId === 'string' ? config.phoneNumberId.trim() : ''
  if (!apiToken || !phoneNumberId) {
    return { ok: false, error: 'WhatsApp no está configurado — cargá el token y el Phone Number ID en Configuración → NISSI.' }
  }

  const digits = normalizeWhatsAppTo(to.replace(/\D/g, ''))
  if (!digits) return { ok: false, error: 'Número de teléfono inválido' }
  if (!message.trim()) return { ok: false, error: 'El mensaje no puede estar vacío' }

  try {
    const res = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: digits,
        type: 'text',
        text: { body: message.trim() },
      }),
    })
    if (!res.ok) {
      const errJson = await res.json().catch(() => null) as { error?: { message?: string } } | null
      return { ok: false, error: errJson?.error?.message || `WhatsApp devolvió un error (HTTP ${res.status})` }
    }
    return { ok: true }
  } catch (err) {
    console.error('[WHATSAPP SEND]', err)
    return { ok: false, error: 'Error de conexión con la API de WhatsApp' }
  }
}
