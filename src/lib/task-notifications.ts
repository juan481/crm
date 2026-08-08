import { prisma } from '@/lib/db'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'

// Email corto al asignar/reasignar una tarea — mismo patrón que el aviso de
// mensaje "público" de Tickets (src/app/api/tickets/[id]/messages/route.ts):
// busca la config de correo de la org, arma el HTML con buildEmailHtml, y no
// tira si la org no tiene el correo configurado (sólo no manda nada).
export async function notifyTaskAssignment(
  task: { id: string; title: string; dueDate: Date | string | null; assignedToId: string },
  orgId: string
): Promise<void> {
  const db = prisma as any

  const assignee = await db.user.findUnique({
    where: { id: task.assignedToId },
    select: { name: true, email: true },
  })
  if (!assignee?.email) return

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      name: true, crmName: true, primaryColor: true, secondaryColor: true,
      smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
      smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
    },
  })
  if (!isOrgEmailConfigured(org)) return

  const orgName = org?.name || org?.crmName || 'CRM'
  const dueLabel = task.dueDate ? new Date(task.dueDate).toLocaleDateString('es-AR') : 'sin fecha límite'
  const html = buildEmailHtml(
    'Te asignaron una tarea nueva',
    `Hola${assignee?.name ? ' ' + assignee.name : ''},\n\nTe asignaron la tarea "${task.title}" (vence: ${dueLabel}). Entrá al CRM para ver el detalle.`,
    orgName,
    org?.primaryColor || '#6366f1',
    org?.secondaryColor || '#8b5cf6',
  )

  await sendEmail({
    to: assignee.email,
    subject: `Tarea nueva: ${task.title}`,
    html,
    smtpConfig: resolveOrgSmtpConfig(org),
  })
}
