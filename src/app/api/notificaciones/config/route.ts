import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  NOTIFICATION_TYPES, NOTIFICATION_META, parseRecipients,
  type NotificationType, type NotificationRecipientRef,
} from '@/lib/notifications'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function sanitizeRecipients(input: unknown): NotificationRecipientRef[] {
  if (!Array.isArray(input)) return []
  const out: NotificationRecipientRef[] = []
  const seen = new Set<string>()
  for (const r of input) {
    if (!r || typeof r !== 'object') continue
    const userId = typeof (r as any).userId === 'string' ? (r as any).userId.trim() : ''
    const email = typeof (r as any).email === 'string' ? (r as any).email.trim().toLowerCase() : ''
    if (userId) {
      if (seen.has('u:' + userId)) continue
      seen.add('u:' + userId)
      out.push({ userId })
    } else if (email && EMAIL_RE.test(email)) {
      if (seen.has('e:' + email)) continue
      seen.add('e:' + email)
      out.push({ email })
    }
  }
  return out
}

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const [rows, users] = await Promise.all([
      (prisma as any).notificationSetting.findMany({
        where: { organizationId: payload.orgId },
        select: { type: true, enabled: true, recipients: true },
      }),
      prisma.user.findMany({
        where: { organizationId: payload.orgId, status: 'ACTIVE' },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: 'asc' },
      }),
    ])

    const byType = new Map<string, { enabled: boolean; recipients: string }>()
    for (const r of rows) byType.set(r.type, r)

    const settings = NOTIFICATION_TYPES.map((type) => {
      const row = byType.get(type)
      return {
        type,
        label: NOTIFICATION_META[type].label,
        description: NOTIFICATION_META[type].description,
        roleFallback: NOTIFICATION_META[type].roleFallback,
        configured: !!row,
        // Sin configurar: apagado por defecto en la UI (el cron ya usa el
        // comportamiento viejo hasta que se guarde acá por primera vez).
        enabled: row?.enabled ?? false,
        recipients: parseRecipients(row?.recipients),
      }
    })

    return NextResponse.json({ data: { settings, users } })
  } catch (error) {
    console.error('[NOTIFICACIONES CONFIG GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const incoming = Array.isArray(body?.settings) ? body.settings : null
    if (!incoming) return NextResponse.json({ error: 'Formato inválido' }, { status: 400 })

    // Los userId que se manden tienen que ser de la misma org (evita filtrar
    // un aviso a un usuario de otra organización).
    const orgUserIds = new Set(
      (await prisma.user.findMany({
        where: { organizationId: payload.orgId },
        select: { id: true },
      })).map((u) => u.id),
    )

    for (const s of incoming) {
      const type = s?.type as NotificationType
      if (!NOTIFICATION_TYPES.includes(type)) continue

      const recipients = sanitizeRecipients(s?.recipients).filter(
        (r) => !r.userId || orgUserIds.has(r.userId),
      )
      const enabled = s?.enabled === true

      if (enabled && recipients.length === 0) {
        return NextResponse.json(
          { error: `"${NOTIFICATION_META[type].label}" está activado pero no tiene destinatarios.` },
          { status: 400 },
        )
      }

      await (prisma as any).notificationSetting.upsert({
        where: { organizationId_type: { organizationId: payload.orgId, type } },
        update: { enabled, recipients: JSON.stringify(recipients) },
        create: { organizationId: payload.orgId, type, enabled, recipients: JSON.stringify(recipients) },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[NOTIFICACIONES CONFIG POST]', error)
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }
}
