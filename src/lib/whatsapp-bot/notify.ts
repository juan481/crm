import { waitUntil } from '@vercel/functions'
import { prisma } from '@/lib/db'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'

// Mismo patrón que notifyCollaboratorAdded (src/lib/collaborator-notifications.ts):
// waitUntil en vez de fire-and-forget a secas, porque en serverless de
// Vercel una promesa no esperada puede cortarse a mitad de camino apenas se
// manda la respuesta al webhook de Meta. La creación del Ticket/Deal en sí
// NO depende de que este mail salga — si el mail falla, el registro en el
// CRM ya quedó guardado y el humano lo va a ver la próxima vez que entre.
async function doNotifyHuman(opts: {
  orgId: string
  toEmail: string
  toName?: string | null
  subject: string
  heading: string
  bodyText: string
}): Promise<void> {
  const db = prisma as any
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
    opts.heading,
    `Hola${opts.toName ? ' ' + opts.toName : ''},\n\n${opts.bodyText}`,
    orgName,
    org?.primaryColor || '#6366f1',
    org?.secondaryColor || '#8b5cf6',
  )

  await sendEmail({
    to: opts.toEmail,
    subject: opts.subject,
    html,
    smtpConfig: resolveOrgSmtpConfig(org),
  })
}

export function notifyHuman(opts: {
  orgId: string
  toEmail: string
  toName?: string | null
  subject: string
  heading: string
  bodyText: string
}): void {
  waitUntil(doNotifyHuman(opts).catch((err) => console.error('[NISSI NOTIFY]', err)))
}
