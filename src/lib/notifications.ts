import { prisma } from '@/lib/db'

// Ruteo de avisos automáticos (crons de digest). La fuente de verdad es la
// tabla NotificationSetting: una fila por (org, tipo). Si NO hay fila para un
// tipo, `resolveNotification` devuelve `configured: false` y el cron cae a su
// comportamiento viejo (gate por plugin + destinatarios por rol) — así las
// demás orgs del CRM no se ven afectadas por este cambio.

export const NOTIFICATION_TYPES = ['attendance', 'it-activity', 'renewals'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_META: Record<NotificationType, { label: string; description: string; roleFallback: string }> = {
  'attendance': {
    label: 'Asistencia diaria',
    description: 'Cada mañana (lun–vie): quién no fichó y quién llegó tarde el último día hábil.',
    roleFallback: 'Administradores y RRHH',
  },
  'it-activity': {
    label: 'Reporte diario de soporte IT',
    description: 'Cada mañana (lun–vie): tickets de soporte nuevos, resueltos, sin asignar, vencidos por SLA y backlog.',
    roleFallback: 'Nadie hasta configurarlo',
  },
  'renewals': {
    label: 'Contratos por vencer',
    description: 'Aviso cuando un contrato de un servicio recurrente vence en 30, 15 o 7 días.',
    roleFallback: 'Nadie hasta configurarlo',
  },
}

export interface NotificationRecipientRef {
  userId?: string
  email?: string
}

export interface ResolvedNotification {
  /** ¿Existe una fila NotificationSetting para este (org, tipo)? */
  configured: boolean
  enabled: boolean
  /** Emails ya resueltos, válidos, en minúscula y sin repetir. */
  emails: string[]
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parseRecipients(raw: string | null | undefined): NotificationRecipientRef[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((r): r is NotificationRecipientRef => r && typeof r === 'object')
      .map((r) => ({
        userId: typeof r.userId === 'string' && r.userId ? r.userId : undefined,
        email: typeof r.email === 'string' && r.email ? r.email.trim().toLowerCase() : undefined,
      }))
      .filter((r) => r.userId || r.email)
  } catch {
    return []
  }
}

export async function resolveNotification(
  orgId: string,
  type: NotificationType,
): Promise<ResolvedNotification> {
  const row = await (prisma as any).notificationSetting.findUnique({
    where: { organizationId_type: { organizationId: orgId, type } },
    select: { enabled: true, recipients: true },
  })
  if (!row) return { configured: false, enabled: false, emails: [] }

  const refs = parseRecipients(row.recipients)
  const userIds = refs.map((r) => r.userId).filter((x): x is string => !!x)
  const literalEmails = refs.map((r) => r.email).filter((x): x is string => !!x)

  let userEmails: string[] = []
  if (userIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, status: 'ACTIVE' },
      select: { email: true },
    })
    userEmails = users.map((u) => u.email)
  }

  const emails = Array.from(
    new Set(
      [...userEmails, ...literalEmails]
        .map((e) => e.trim().toLowerCase())
        .filter((e) => EMAIL_RE.test(e)),
    ),
  )

  return { configured: true, enabled: !!row.enabled, emails }
}
