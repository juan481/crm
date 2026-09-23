import { waitUntil } from '@vercel/functions'
import { prisma } from '@/lib/db'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'

// Mismo patrón que notifyTaskAssignment (src/lib/task-notifications.ts) —
// antes un ticket creado a mano desde el CRM no le avisaba a nadie por
// mail (sólo a colaboradores, ver collaborator-notifications.ts). Se agrega
// ahora puntualmente para poder cumplir el pedido de Abba de "copia (CC)
// para casos sensibles" — sin esto, ccEmails quedaba guardado pero inerte.
async function doNotifyTicketCreated(
  ticket: { id: string; number: number; title: string; assignedToId: string | null; ccEmails?: string[] },
  orgId: string
): Promise<void> {
  const db = prisma as any

  const assignee = ticket.assignedToId
    ? await db.user.findUnique({ where: { id: ticket.assignedToId }, select: { name: true, email: true } })
    : null
  const cc = (ticket.ccEmails ?? []).filter((e) => e !== assignee?.email)
  if (!assignee?.email && cc.length === 0) return

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
  const html = buildEmailHtml(
    `Ticket nuevo #${ticket.number}`,
    `Hola${assignee?.name ? ' ' + assignee.name : ''},\n\n${assignee ? `Te asignaron el` : 'Se creó el'} ticket #${ticket.number} "${ticket.title}". Entrá al CRM para ver el detalle.`,
    orgName,
    org?.primaryColor || '#6366f1',
    org?.secondaryColor || '#8b5cf6',
  )

  // "Copia" real (header Cc) no está soportada por los 3 proveedores de
  // envío (SES/Brevo/SMTP) sin plomería extra en cada uno — se manda como
  // destinatarios adicionales en `to`. Cumple el objetivo real (que el
  // supervisor se entere), aunque no aparezca como "Cc:" en su bandeja.
  const to = [assignee?.email, ...cc].filter((e): e is string => !!e)
  if (to.length === 0) return

  await sendEmail({
    to,
    subject: `Ticket nuevo #${ticket.number}: ${ticket.title}`,
    html,
    smtpConfig: resolveOrgSmtpConfig(org),
  })
}

export function notifyTicketCreated(
  ticket: { id: string; number: number; title: string; assignedToId: string | null; ccEmails?: string[] },
  orgId: string
): void {
  waitUntil(doNotifyTicketCreated(ticket, orgId).catch((err) => console.error('[TICKET CREATED EMAIL]', err)))
}
