import { prisma } from '@/lib/db'

// Helpers server-side para leer el estado de un plugin por organización —
// misma tabla (PluginConfig) que ya usa /api/plugins, sin pasar por HTTP.
// Usado desde rutas/cron que necesitan saber si un plugin está activo antes
// de disparar su efecto (webhooks salientes, facturación automática).

export async function isPluginEnabled(orgId: string, pluginId: string): Promise<boolean> {
  const cfg = await prisma.pluginConfig.findUnique({
    where: { pluginId_organizationId: { pluginId, organizationId: orgId } },
    select: { enabled: true },
  })
  return cfg?.enabled ?? false
}

export async function getPluginConfig(orgId: string, pluginId: string): Promise<Record<string, unknown> | null> {
  const cfg = await prisma.pluginConfig.findUnique({
    where: { pluginId_organizationId: { pluginId, organizationId: orgId } },
    select: { enabled: true, config: true },
  })
  if (!cfg?.enabled || !cfg.config) return null
  try { return JSON.parse(cfg.config) } catch { return null }
}
