import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PLUGIN_DEFINITIONS } from '@/plugins/definitions'

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const configs = await prisma.pluginConfig.findMany({
      where: { organizationId: payload.orgId },
    })

    const plugins = PLUGIN_DEFINITIONS.map((def) => {
      const cfg = configs.find((c) => c.pluginId === def.id)
      let parsedConfig: Record<string, unknown> | null = null
      if (cfg?.config) {
        try { parsedConfig = JSON.parse(cfg.config) } catch { parsedConfig = null }
      }
      return {
        ...def,
        enabled: cfg?.enabled ?? false,
        config: parsedConfig,
      }
    })

    return NextResponse.json({ data: plugins })
  } catch (error) {
    console.error('[PLUGINS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Solo Super Admin puede gestionar plugins' }, { status: 403 })
    }

    const { pluginId, enabled, config } = await req.json()

    const def = PLUGIN_DEFINITIONS.find((p) => p.id === pluginId)
    if (!def) return NextResponse.json({ error: 'Plugin no encontrado' }, { status: 404 })

    const configStr = config !== undefined ? JSON.stringify(config) : undefined
    const pluginConfig = await prisma.pluginConfig.upsert({
      where: { pluginId_organizationId: { pluginId, organizationId: payload.orgId } },
      update: { enabled, ...(configStr !== undefined && { config: configStr }) },
      create: { pluginId, enabled, config: configStr ?? null, organizationId: payload.orgId },
    })

    return NextResponse.json({ data: pluginConfig, message: enabled ? 'Plugin activado' : 'Plugin desactivado' })
  } catch (error) {
    console.error('[PLUGINS POST]', error)
    return NextResponse.json({ error: 'Error al actualizar plugin' }, { status: 500 })
  }
}
