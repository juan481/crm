import { getPluginConfig } from '@/lib/plugins'

// Config tipada del plugin whatsapp-ai-bot (ver src/plugins/definitions.ts
// para el configSchema crudo que llena esto desde la UI de Plugins). Todo
// opcional salvo lo estrictamente necesario para hablar con Meta/Google —
// los datos institucionales (horario, dirección, etc.) son best-effort: si
// faltan, el prompt le dice a la IA que no invente y derive a un humano en
// vez de inventar una respuesta.
export interface WhatsAppBotConfig {
  apiToken: string
  phoneNumberId: string
  // API Key de Google Gemini (Google AI Studio) — el motor de NISSI corre
  // sobre Gemini Flash (ver src/lib/whatsapp-bot/engine.ts).
  geminiApiKey: string
  // Modelo de Gemini a usar. Opcional — default 'gemini-2.5-flash'. Se deja
  // configurable para poder bajar a 'gemini-2.5-flash-lite' (más barato) sin
  // un deploy si la calidad del tool-calling aguanta.
  geminiModel: string | null
  businessHours: string | null
  address: string | null
  coverage: string | null
  paymentMethods: string | null
  salesContactEmail: string | null
  billingContactEmail: string | null
}

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}
function strOrNull(v: unknown): string | null {
  const s = str(v)
  return s || null
}

/** Lee y valida la config del plugin para una org. Devuelve null si el
 *  plugin está apagado o le faltan las 3 credenciales imprescindibles
 *  (WhatsApp token+phoneNumberId, Gemini key) — sin eso no hay forma de
 *  ni recibir ni contestar nada, así que no tiene sentido devolver un
 *  objeto a medias. */
export async function getWhatsAppBotConfig(orgId: string): Promise<WhatsAppBotConfig | null> {
  const raw = await getPluginConfig(orgId, 'whatsapp-ai-bot')
  if (!raw) return null

  const apiToken = str(raw.apiToken)
  const phoneNumberId = str(raw.phoneNumberId)
  // Compat: hasta la migración a Gemini el campo se llamaba `anthropicApiKey`.
  // Si una org quedó con la key vieja cargada, el plugin igual valida como
  // "sin configurar" (la key de Anthropic no sirve para Gemini) — es
  // intencional, obliga a re-guardar con la key correcta.
  const geminiApiKey = str(raw.geminiApiKey)
  if (!apiToken || !phoneNumberId || !geminiApiKey) return null

  return {
    apiToken,
    phoneNumberId,
    geminiApiKey,
    geminiModel: strOrNull(raw.geminiModel),
    businessHours: strOrNull(raw.businessHours),
    address: strOrNull(raw.address),
    coverage: strOrNull(raw.coverage),
    paymentMethods: strOrNull(raw.paymentMethods),
    salesContactEmail: strOrNull(raw.salesContactEmail),
    billingContactEmail: strOrNull(raw.billingContactEmail),
  }
}
