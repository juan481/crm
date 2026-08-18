import { prisma } from '@/lib/db'
import { getWhatsAppBotConfig, type WhatsAppBotConfig } from '@/lib/whatsapp-bot/config'

// El webhook de Meta es UNO SOLO por app (compartido por todas las
// organizaciones que activen el plugin, presente o futuras) — lo único que
// viaja en cada mensaje entrante para saber a qué organización pertenece es
// `metadata.phone_number_id`. PluginConfig.config es un String (JSON
// serializado a mano, ver src/lib/plugins.ts), así que no se puede filtrar
// por phoneNumberId directo en la query — con la cantidad de organizaciones
// que tiene esta plataforma hoy (unas pocas) traer todas las filas
// habilitadas de este plugin y comparar en JS es más simple que pelear con
// un filtro JSON crudo en Postgres, y no es un endpoint de alto tráfico.
export async function resolveOrgByPhoneNumberId(phoneNumberId: string): Promise<{ orgId: string; config: WhatsAppBotConfig } | null> {
  const db = prisma as any
  const rows = await db.pluginConfig.findMany({
    where: { pluginId: 'whatsapp-ai-bot', enabled: true },
    select: { organizationId: true },
  })
  for (const row of rows) {
    const config = await getWhatsAppBotConfig(row.organizationId)
    if (config?.phoneNumberId === phoneNumberId) return { orgId: row.organizationId, config }
  }
  return null
}

// Ticket.createdById y Deal.ownerId son NOT NULL — no existe un "usuario
// sistema" en el schema (a propósito, para no abrir un agujero de
// permisos: cualquier fila que use ese id heredaría lo que ese rol puede
// hacer). En vez de eso, los Tickets/Deals que arma NISSI quedan
// atribuidos al SUPER_ADMIN más antiguo de la organización que NO sea un
// admin de plataforma (isPlatformAdmin) — es la persona real que más
// probablemente sea querida como "dueño de casa" del CRM de esa empresa.
// La descripción del ticket/deal siempre aclara igual que lo armó NISSI.
let cache = new Map<string, string | null>()
export async function resolveBotActorId(orgId: string): Promise<string | null> {
  if (cache.has(orgId)) return cache.get(orgId)!
  const db = prisma as any
  const candidate =
    (await db.user.findFirst({
      where: { organizationId: orgId, role: 'SUPER_ADMIN', isPlatformAdmin: false, status: { not: 'DELETED' } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })) ||
    (await db.user.findFirst({
      where: { organizationId: orgId, role: 'SUPER_ADMIN', status: { not: 'DELETED' } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })) ||
    (await db.user.findFirst({
      where: { organizationId: orgId, role: 'ADMIN', status: { not: 'DELETED' } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }))
  const id = candidate?.id ?? null
  cache.set(orgId, id)
  return id
}
