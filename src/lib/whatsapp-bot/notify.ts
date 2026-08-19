import { waitUntil } from '@vercel/functions'
import { prisma } from '@/lib/db'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'

// Bug real encontrado en auditoría: `buildEmailHtml` interpola `subject`/
// `body` sin escapar HTML (helper preexistente, usado en varios lugares del
// proyecto con texto tipeado por usuarios del CRM ya logueados). Acá el
// `heading`/`bodyText` vienen en última instancia de lo que un CLIENTE le
// pide a la IA por WhatsApp que anote (título/descripción del ticket o
// resumen del lead) — un canal externo no autenticado. Sin escapar, un
// cliente podría lograr que NISSI anote algo con markup (ej. un link o un
// `<img onerror=...>`) que termine renderizado como HTML vivo en el mail
// que abre el técnico/vendedor. Se escapa acá, en el borde donde este texto
// entra a un email, en vez de tocar `buildEmailHtml` (que otros call sites
// del proyecto podrían depender de su comportamiento actual).
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

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
    escapeHtml(opts.heading),
    `Hola${opts.toName ? ' ' + opts.toName : ''},\n\n${escapeHtml(opts.bodyText)}`,
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

// waitUntil, no fire-and-forget — mismo motivo que notifyCollaboratorAdded.
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
