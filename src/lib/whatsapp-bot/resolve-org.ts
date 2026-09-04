import { prisma } from '@/lib/db'
import { getPluginConfig } from '@/lib/plugins'
import { parseWhatsAppBotConfig, type WhatsAppBotConfig } from '@/lib/whatsapp-bot/config'

// El webhook de Meta es UNO SOLO por app (compartido por todas las
// organizaciones que activen el plugin, presente o futuras) — lo único que
// viaja en cada mensaje entrante para saber a qué organización pertenece es
// `metadata.phone_number_id`. PluginConfig.config es un String (JSON
// serializado a mano, ver src/lib/plugins.ts), así que no se puede filtrar
// por phoneNumberId directo en la query — con la cantidad de organizaciones
// que tiene esta plataforma hoy (unas pocas) traer todas las filas
// habilitadas de este plugin y comparar en JS es más simple que pelear con
// un filtro JSON crudo en Postgres, y no es un endpoint de alto tráfico.
//
// IMPORTANTE: el match a la organización se hace con el phoneNumberId CRUDO
// (getPluginConfig), NO con la config validada — así, si al plugin le falta
// la API key de Gemini (ej. durante la ventana entre deploy y re-guardar la
// config con la key nueva), igual sabemos a qué org pertenece el mensaje y
// lo guardamos en el inbox en vez de perderlo. `config` viene null en ese
// caso y el engine guarda el mensaje sin invocar al modelo.
// El nombre de la organización se usa en cada mensaje entrante (va al prompt)
// y cambia rarísimo — se cachea a nivel módulo por la vida de la instancia
// tibia, igual que resolveBotActorId.
const orgNameCache = new Map<string, string>()

export async function resolveOrgByPhoneNumberId(
  phoneNumberId: string,
): Promise<{ orgId: string; orgName: string; config: WhatsAppBotConfig | null } | null> {
  const db = prisma as any
  const rows = await db.pluginConfig.findMany({
    where: { pluginId: 'whatsapp-ai-bot', enabled: true },
    select: { organizationId: true },
  })
  const raws = await Promise.all(rows.map((row: { organizationId: string }) => getPluginConfig(row.organizationId, 'whatsapp-ai-bot')))
  const match = rows.findIndex((_row: unknown, i: number) => {
    const pid = raws[i]?.phoneNumberId
    return typeof pid === 'string' && pid.trim() === phoneNumberId
  })
  if (match === -1) return null
  const orgId = rows[match].organizationId
  // Ya tenemos el JSON crudo del map — validar en memoria, sin re-consultar.
  const config = parseWhatsAppBotConfig(raws[match])

  let orgName = orgNameCache.get(orgId)
  if (!orgName) {
    const org = await db.organization.findUnique({ where: { id: orgId }, select: { name: true, crmName: true } })
    orgName = (org?.name || org?.crmName || 'nuestra empresa') as string
    orgNameCache.set(orgId, orgName)
  }
  return { orgId, orgName, config }
}

// Ticket.createdById y Deal.ownerId son NOT NULL — no existe un "usuario
// sistema" en el schema (a propósito, para no abrir un agujero de
// permisos: cualquier fila que use ese id heredaría lo que ese rol puede
// hacer). En vez de eso, los Tickets/Deals que arma NISSI quedan
// atribuidos al SUPER_ADMIN más antiguo de la organización que NO sea un
// admin de plataforma (isPlatformAdmin) — es la persona real que más
// probablemente sea querida como "dueño de casa" del CRM de esa empresa.
// La descripción del ticket/deal siempre aclara igual que lo armó NISSI.
// Sólo se cachean resultados POSITIVOS — si una org todavía no tiene ningún
// SUPER_ADMIN/ADMIN (ej. recién activó el plugin y está configurando todo),
// cachear el `null` la dejaría "atascada" devolviendo ese mismo error el
// resto de la vida de esta instancia tibia de la función serverless, incluso
// después de que alguien cree el primer admin — un caso real y no tan raro
// dado que este es justo el flujo de alta de una organización nueva.
const cache = new Map<string, string>()
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
  if (id) cache.set(orgId, id)
  return id
}
