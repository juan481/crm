import { canAccess } from '@/lib/auth'
import { getPluginConfig } from '@/lib/plugins'
import { DEFAULT_REPLY_ROLE } from '@/lib/whatsapp-bot/nissi-shared'
import type { Role } from '@/types'

// VER la bandeja de WhatsApp se controla con el módulo "conversaciones"
// (Configuración → Permisos, minRole SELLER). RESPONDER / TOMAR / DEVOLVER se
// controla acá, con config.replyRoleMin (default SELLER). Nunca por debajo de
// SELLER — por debajo ni se ve la bandeja.
const FLOOR: Role = 'SELLER'
const VALID: Role[] = ['SUPER_ADMIN', 'ADMIN', 'SELLER', 'HR', 'TECHNICIAN']

export async function getReplyRoleMin(orgId: string): Promise<Role> {
  const raw = await getPluginConfig(orgId, 'whatsapp-ai-bot')
  const v = raw?.replyRoleMin
  const configured = typeof v === 'string' && (VALID as string[]).includes(v) ? (v as Role) : DEFAULT_REPLY_ROLE
  // clamp: nunca menos que SELLER
  return canAccess(configured, FLOOR) ? configured : FLOOR
}

export async function canReplyToConversations(orgId: string, role: Role): Promise<boolean> {
  return canAccess(role, await getReplyRoleMin(orgId))
}
