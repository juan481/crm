import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PLUGIN_DEFINITIONS } from '@/plugins/definitions'
import { unstable_cache, revalidateTag } from 'next/cache'

async function fetchPlugins(orgId: string) {
  const [configs, org] = await Promise.all([
    prisma.pluginConfig.findMany({ where: { organizationId: orgId } }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.organization as any).findUnique({ where: { id: orgId }, select: { vertical: true } }),
  ])
  const vertical: string | null = org?.vertical ?? null

  return PLUGIN_DEFINITIONS
    // Sin `verticals` declarado = visible para todos (retrocompat con lo que
    // ya ve Abba). Con `verticals` declarado, sólo aparece si coincide con
    // el rubro de la organización.
    .filter((def) => !def.verticals || (vertical !== null && def.verticals.includes(vertical)))
    .map((def) => {
      const cfg = configs.find((c) => c.pluginId === def.id)
      let parsedConfig: Record<string, unknown> | null = null
      if (cfg?.config) {
        try { parsedConfig = JSON.parse(cfg.config) } catch { parsedConfig = null }
      }
      return { ...def, enabled: cfg?.enabled ?? false, config: parsedConfig }
    })
}

// Plugins change rarely — cache 5 minutes per org
const getCachedPlugins = unstable_cache(
  fetchPlugins,
  ['plugins'],
  { revalidate: 300, tags: ['plugins'] }
)

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const plugins = await getCachedPlugins(payload.orgId)

    // Sólo quien puede gestionar plugins (POST de acá abajo, SUPER_ADMIN) ve
    // los campos marcados `type: 'password'` en configSchema. Sin esto,
    // CUALQUIER usuario autenticado (un SELLER, por ejemplo — que ni
    // siquiera tiene el link de Configuración/Plugins en el sidebar) recibía
    // el `config` completo ya parseado apenas la app pedía este endpoint
    // para decidir si mostrar un botón condicionado a un plugin (ej.
    // WhatsAppSendButton vía usePlugin/usePlugins en fichas de
    // contacto/empresa) — filtrando en texto plano el token de WhatsApp
    // Business, el Client Secret de Google Calendar, etc. Cache-Control
    // 'private' (no 'public'/default) porque la respuesta ahora varía según
    // el rol de quien pide, no sólo según la organización.
    const canManagePlugins = canAccess(payload.role, 'SUPER_ADMIN')
    const data = canManagePlugins ? plugins : plugins.map((p) => {
      if (!p.config || !p.configSchema) return p
      const redacted = { ...p.config }
      for (const [key, field] of Object.entries(p.configSchema)) {
        if (field.type === 'password' && key in redacted) redacted[key] = null
      }
      return { ...p, config: redacted }
    })

    return NextResponse.json(
      { data },
      { headers: { 'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=3600' } }
    )
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

    revalidateTag('plugins')

    return NextResponse.json({ data: pluginConfig, message: enabled ? 'Plugin activado' : 'Plugin desactivado' })
  } catch (error) {
    console.error('[PLUGINS POST]', error)
    return NextResponse.json({ error: 'Error al actualizar plugin' }, { status: 500 })
  }
}
