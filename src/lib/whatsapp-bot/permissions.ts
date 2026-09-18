import { canAccess } from '@/lib/auth'
import { getPluginConfig } from '@/lib/plugins'
import { DEFAULT_REPLY_ROLE } from '@/lib/whatsapp-bot/nissi-shared'
import type { Role } from '@/types'

// VER la bandeja de WhatsApp se controla con el módulo "conversaciones"
// (Configuración → Permisos, minRole TECHNICIAN — RRHH y Técnicos pueden
// ganarlo ahí). RESPONDER / TOMAR / DEVOLVER se controla acá, con
// config.replyRoleMin (default SELLER, configurable en Configuración →
// NISSI). El piso bajó a TECHNICIAN en simultáneo con el de VER — antes
// nunca podía ser menor a SELLER porque por debajo de eso ni se veía la
// bandeja; ahora que sí se puede ver, no tiene sentido que responder siga
// más restringido por una regla que ya no aplica.
const FLOOR: Role = 'TECHNICIAN'
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
