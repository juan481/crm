import { getPluginConfig } from '@/lib/plugins'

interface SendResult { ok: boolean; error?: string }

// Envío server-side vía WhatsApp Cloud API (Meta) — plugin
// whatsapp-integration, configSchema { apiToken, phoneNumberId }, cargados
// por el SUPER_ADMIN de la organización desde el modal genérico de
// plugins. Sin esas credenciales configuradas, el endpoint que llama a
// esto devuelve un error claro en vez de intentar mandar nada.
//
// LIMITACIÓN CONOCIDA (API de Meta, no de este código): un número de
// WhatsApp Business sólo puede mandar mensajes de texto libres dentro de
// las 24hs desde el último mensaje que ESE contacto le mandó a la
// empresa — fuera de esa ventana, Meta exige un "template" pre-aprobado
// en Meta Business Manager en vez de texto libre, y esta primera versión
// no lo soporta. Si el envío falla por eso, Meta lo devuelve como error
// específico y se lo pasamos tal cual al usuario.
export async function sendWhatsAppMessage(orgId: string, to: string, message: string): Promise<SendResult> {
  const config = await getPluginConfig(orgId, 'whatsapp-integration')
  const apiToken = typeof config?.apiToken === 'string' ? config.apiToken.trim() : ''
  const phoneNumberId = typeof config?.phoneNumberId === 'string' ? config.phoneNumberId.trim() : ''
  if (!apiToken || !phoneNumberId) {
    return { ok: false, error: 'WhatsApp Business no está configurado — cargá el API Token y el Phone Number ID en Plugins.' }
  }

  const digits = to.replace(/\D/g, '')
  if (!digits) return { ok: false, error: 'Número de teléfono inválido' }
  if (!message.trim()) return { ok: false, error: 'El mensaje no puede estar vacío' }

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
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
