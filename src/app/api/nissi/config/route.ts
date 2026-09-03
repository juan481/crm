import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { revalidateTag } from 'next/cache'
import {
  DEFAULT_GEMINI_MODEL, DEFAULT_REPLY_ROLE, NISSI_DEFAULT_INSTRUCTIONS, NISSI_INSTRUCTIONS_MAX,
} from '@/lib/whatsapp-bot/nissi-shared'

export const dynamic = 'force-dynamic'

const PLUGIN_ID = 'whatsapp-ai-bot'

// Campos que edita la pantalla /configuracion/nissi. Se guardan como JSON en
// PluginConfig.config (lo mismo que lee getWhatsAppBotConfig). El resto del
// sistema (engine, rutas de la bandeja) no cambia.
const STRING_FIELDS = [
  'apiToken', 'phoneNumberId', 'geminiApiKey', 'geminiModel',
  'businessName', 'businessHours', 'address', 'coverage', 'paymentMethods', 'phones', 'website',
  'styleNote',
  'salesContactEmail', 'salesContactName', 'supportContactEmail', 'supportContactName',
  'billingContactEmail', 'billingContactName',
] as const

const TONES = ['cercano', 'formal', 'neutro']
const REPLY_ROLES = ['SELLER', 'ADMIN', 'SUPER_ADMIN']

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const [row, users, org] = await Promise.all([
      prisma.pluginConfig.findUnique({
        where: { pluginId_organizationId: { pluginId: PLUGIN_ID, organizationId: payload.orgId } },
        select: { enabled: true, config: true },
      }),
      prisma.user.findMany({
        where: { organizationId: payload.orgId, status: 'ACTIVE' },
        select: { name: true, email: true, role: true },
        orderBy: { name: 'asc' },
      }),
      (prisma.organization as any).findUnique({ where: { id: payload.orgId }, select: { name: true, crmName: true } }),
    ])

    let cfg: Record<string, unknown> = {}
    if (row?.config) { try { cfg = JSON.parse(row.config) } catch { cfg = {} } }

    // No mandamos las credenciales en claro — sólo si están cargadas.
    const has = (k: string) => str(cfg[k]).length > 0
    const publicCfg: Record<string, unknown> = {}
    for (const k of STRING_FIELDS) {
      if (k === 'apiToken' || k === 'geminiApiKey') continue
      publicCfg[k] = str(cfg[k]) || null
    }
    publicCfg.tone = TONES.includes(cfg.tone as string) ? cfg.tone : null
    publicCfg.instructions = str(cfg.instructions) || null
    publicCfg.replyRoleMin = REPLY_ROLES.includes(cfg.replyRoleMin as string) ? cfg.replyRoleMin : null
    publicCfg.abuseGuardEnabled = cfg.abuseGuardEnabled !== false

    return NextResponse.json({
      data: {
        enabled: row?.enabled ?? false,
        config: publicCfg,
        credentials: { apiToken: has('apiToken'), geminiApiKey: has('geminiApiKey') },
        orgName: org?.name || org?.crmName || '',
        users,
        defaults: {
          geminiModel: DEFAULT_GEMINI_MODEL,
          replyRoleMin: DEFAULT_REPLY_ROLE,
          instructions: NISSI_DEFAULT_INSTRUCTIONS,
          instructionsMax: NISSI_INSTRUCTIONS_MAX,
        },
      },
    })
  } catch (error) {
    console.error('[NISSI CONFIG GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const patch: Record<string, unknown> = (body && typeof body === 'object' ? body.config : null) ?? {}

    // Config previa (para no borrar credenciales que la UI no re-manda por
    // estar enmascaradas).
    const row = await prisma.pluginConfig.findUnique({
      where: { pluginId_organizationId: { pluginId: PLUGIN_ID, organizationId: payload.orgId } },
      select: { config: true },
    })
    let current: Record<string, unknown> = {}
    if (row?.config) { try { current = JSON.parse(row.config) } catch { current = {} } }

    const next: Record<string, unknown> = { ...current }

    for (const k of STRING_FIELDS) {
      if (!(k in patch)) continue
      const v = str(patch[k])
      // Credenciales: string vacío = "no la toques" (la UI no re-manda el
      // valor enmascarado). Para borrarla hay un flag aparte.
      if ((k === 'apiToken' || k === 'geminiApiKey') && !v) continue
      next[k] = v || null
    }

    if ('tone' in patch) next.tone = TONES.includes(patch.tone as string) ? patch.tone : null
    if ('replyRoleMin' in patch) next.replyRoleMin = REPLY_ROLES.includes(patch.replyRoleMin as string) ? patch.replyRoleMin : null
    if ('abuseGuardEnabled' in patch) next.abuseGuardEnabled = patch.abuseGuardEnabled !== false
    if ('instructions' in patch) {
      const ins = str(patch.instructions)
      if (ins.length > NISSI_INSTRUCTIONS_MAX) {
        return NextResponse.json({ error: `Las instrucciones no pueden pasar los ${NISSI_INSTRUCTIONS_MAX} caracteres.` }, { status: 400 })
      }
      // Guardar null si quedó igual al default (para heredar cambios futuros)
      next.instructions = ins && ins !== NISSI_DEFAULT_INSTRUCTIONS ? ins : null
    }

    // Email simple check (no bloqueante duro, sólo avisa)
    for (const k of ['salesContactEmail', 'supportContactEmail', 'billingContactEmail']) {
      const v = str(next[k])
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        return NextResponse.json({ error: `El email de ${k.replace('ContactEmail', '')} no parece válido.` }, { status: 400 })
      }
    }

    // Guardar la config NO cambia el estado enabled del plugin — eso se
    // maneja desde Plugins & Extensiones. Sólo al crearlo por primera vez se
    // deja activo (configurarlo implica querer usarlo).
    await prisma.pluginConfig.upsert({
      where: { pluginId_organizationId: { pluginId: PLUGIN_ID, organizationId: payload.orgId } },
      update: { config: JSON.stringify(next) },
      create: { pluginId: PLUGIN_ID, organizationId: payload.orgId, enabled: true, config: JSON.stringify(next) },
    })
    revalidateTag('plugins')

    const ready = !!str(next.apiToken) && !!str(next.phoneNumberId) && !!str(next.geminiApiKey)
    return NextResponse.json({ ok: true, ready })
  } catch (error) {
    console.error('[NISSI CONFIG POST]', error)
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }
}
