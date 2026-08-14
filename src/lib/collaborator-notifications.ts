import { waitUntil } from '@vercel/functions'
import { prisma } from '@/lib/db'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'

// Mismo patrón que notifyTaskAssignment (src/lib/task-notifications.ts) pero
// para el aviso de "te sumaron como colaborador" — la posibilidad NUEVA de
// tener más de una persona en una tarea/ticket. Sólo se llama para
// colaboradores recién agregados (nunca para el asignado principal, que ya
// tiene su propio aviso, ni para alguien que ya estaba en la lista).
async function doNotifyCollaboratorAdded(opts: {
  userId: string
  orgId: string
  kind: 'tarea' | 'ticket'
  title: string
  entityId: string
}): Promise<void> {
  const db = prisma as any
  const user = await db.user.findUnique({ where: { id: opts.userId }, select: { name: true, email: true } })
  if (!user?.email) return

  const org = await db.organization.findUnique({
    where: { id: opts.orgId },
    select: {
      name: true, crmName: true, primaryColor: true, secondaryColor: true,
      smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
      smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
    },
  })
  if (!isOrgEmailConfigured(org)) return

  const orgName = org?.name || org?.crmName || 'CRM'
  const html = buildEmailHtml(
    `Te sumaron a ${opts.kind === 'tarea' ? 'una tarea' : 'un ticket'}`,
    `Hola${user?.name ? ' ' + user.name : ''},\n\nTe agregaron como colaborador${opts.kind === 'tarea' ? ' de la tarea' : ' del ticket'} "${opts.title}". Entrá al CRM para ver el detalle.`,
    orgName,
    org?.primaryColor || '#6366f1',
    org?.secondaryColor || '#8b5cf6',
  )

  await sendEmail({
    to: user.email,
    subject: `Te sumaron ${opts.kind === 'tarea' ? 'a una tarea' : 'a un ticket'}: ${opts.title}`,
    html,
    smtpConfig: resolveOrgSmtpConfig(org),
  })
}

// waitUntil, no fire-and-forget — mismo motivo que notifyTaskAssignment:
// en serverless de Vercel una promesa no esperada puede cortarse a mitad de
// camino apenas se manda la respuesta.
export function notifyCollaboratorAdded(opts: {
  userId: string
  orgId: string
  kind: 'tarea' | 'ticket'
  title: string
  entityId: string
}): void {
  waitUntil(doNotifyCollaboratorAdded(opts).catch((err) => console.error('[COLLABORATOR ADDED EMAIL]', err)))
}
