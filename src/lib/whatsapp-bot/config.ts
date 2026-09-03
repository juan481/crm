import { getPluginConfig } from '@/lib/plugins'
import type { Role } from '@/types'
import type { NissiTone } from '@/lib/whatsapp-bot/nissi-shared'

export type { NissiTone } from '@/lib/whatsapp-bot/nissi-shared'
export { DEFAULT_GEMINI_MODEL, DEFAULT_REPLY_ROLE, NISSI_TONES } from '@/lib/whatsapp-bot/nissi-shared'

// Config del plugin whatsapp-ai-bot (NISSI). Se guarda como JSON en
// PluginConfig.config y se edita desde /configuracion/nissi (no desde el
// modal genérico de plugins). Dos bloques:
//  - CONEXIÓN: lo estrictamente técnico para hablar con Meta/Google.
//  - COMPORTAMIENTO: datos de la empresa, tono, derivación, instrucciones.
// Todo lo de comportamiento es opcional/best-effort: si falta, el prompt le
// dice a la IA que no invente y derive a un humano.
export interface WhatsAppBotConfig {
  // ── Conexión ────────────────────────────────────────────────────────────
  apiToken: string
  phoneNumberId: string
  // API Key de Google Gemini (Google AI Studio) — el motor corre sobre
  // Gemini Flash-Lite (ver src/lib/whatsapp-bot/engine.ts).
  geminiApiKey: string
  // Opcional — default DEFAULT_GEMINI_MODEL. Configurable para cambiarlo sin
  // deploy (ej. 'gemini-3.6-flash' si el lite falla algún escenario).
  geminiModel: string | null

  // ── Empresa ─────────────────────────────────────────────────────────────
  businessName: string | null
  businessHours: string | null
  address: string | null
  coverage: string | null
  paymentMethods: string | null
  phones: string | null
  website: string | null

  // ── Estilo ──────────────────────────────────────────────────────────────
  tone: NissiTone | null
  styleNote: string | null

  // ── Derivación ──────────────────────────────────────────────────────────
  salesContactEmail: string | null
  salesContactName: string | null
  supportContactEmail: string | null
  supportContactName: string | null
  billingContactEmail: string | null
  billingContactName: string | null

  // ── Instrucciones (bloque editable del prompt) ──────────────────────────
  // null = usar NISSI_DEFAULT_INSTRUCTIONS. El núcleo de seguridad NUNCA sale
  // de acá — vive en código y siempre se antepone (ver system-prompt.ts).
  instructions: string | null

  // ── Operación ───────────────────────────────────────────────────────────
  // Rol mínimo para RESPONDER desde la bandeja (ver desde el módulo de
  // permisos sigue siendo aparte). null = SELLER (comportamiento histórico).
  replyRoleMin: Role | null
  // Frenar mensajes de relleno / repetidos para no gastar tokens. Default on.
  abuseGuardEnabled: boolean
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}
function strOrNull(v: unknown): string | null {
  const s = str(v)
  return s || null
}
function toneOrNull(v: unknown): NissiTone | null {
  return v === 'cercano' || v === 'formal' || v === 'neutro' ? v : null
}
const VALID_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'SELLER', 'HR', 'TECHNICIAN']
function roleOrNull(v: unknown): Role | null {
  return typeof v === 'string' && (VALID_ROLES as string[]).includes(v) ? (v as Role) : null
}

/** Lee y valida la config del plugin para una org. Devuelve null si el
 *  plugin está apagado o le faltan las 3 credenciales imprescindibles
 *  (WhatsApp token+phoneNumberId, Gemini key). */
export async function getWhatsAppBotConfig(orgId: string): Promise<WhatsAppBotConfig | null> {
  const raw = await getPluginConfig(orgId, 'whatsapp-ai-bot')
  if (!raw) return null

  const apiToken = str(raw.apiToken)
  const phoneNumberId = str(raw.phoneNumberId)
  const geminiApiKey = str(raw.geminiApiKey)
  if (!apiToken || !phoneNumberId || !geminiApiKey) return null

  return {
    apiToken,
    phoneNumberId,
    geminiApiKey,
    geminiModel: strOrNull(raw.geminiModel),

    businessName: strOrNull(raw.businessName),
    businessHours: strOrNull(raw.businessHours),
    address: strOrNull(raw.address),
    coverage: strOrNull(raw.coverage),
    paymentMethods: strOrNull(raw.paymentMethods),
    phones: strOrNull(raw.phones),
    website: strOrNull(raw.website),

    tone: toneOrNull(raw.tone),
    styleNote: strOrNull(raw.styleNote),

    salesContactEmail: strOrNull(raw.salesContactEmail),
    salesContactName: strOrNull(raw.salesContactName),
    supportContactEmail: strOrNull(raw.supportContactEmail),
    supportContactName: strOrNull(raw.supportContactName),
    billingContactEmail: strOrNull(raw.billingContactEmail),
    billingContactName: strOrNull(raw.billingContactName),

    instructions: strOrNull(raw.instructions),

    replyRoleMin: roleOrNull(raw.replyRoleMin),
    // default true — sólo se apaga si está explícitamente en false
    abuseGuardEnabled: raw.abuseGuardEnabled !== false,
  }
}
