import { prisma } from '@/lib/db'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'

// Aviso por mail a los ADMIN / SUPER_ADMIN de una organización. Es lo que usan
// la conciliación de pagos, el cron de facturación y el auto-envío para
// avisarle al staff (cobros recibidos, fallos, reembolsos).
//
// Destinatarios: TODOS los usuarios ACTIVOS con rol SUPER_ADMIN o ADMIN de esa
// organización. En la práctica el dueño es SUPER_ADMIN; los vendedores son
// SELLER y NO reciben estos avisos. Si hay varios admin, le llega a todos.
export async function notifyOrgStaff(orgId: string, subject: string, body: string): Promise<void> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        name: true, crmName: true, primaryColor: true, secondaryColor: true,
        smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
        smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
      },
    })
    if (!org || !isOrgEmailConfigured(org)) return

    const staff = await prisma.user.findMany({
      where: { organizationId: orgId, status: 'ACTIVE', role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
      select: { email: true },
    })
    const emails = staff.map((s) => s.email).filter(Boolean)
    if (emails.length === 0) return

    const orgName = org.name || org.crmName || 'CRM'
    const html = buildEmailHtml(subject, body, orgName, org.primaryColor || '#6366f1', org.secondaryColor || '#8b5cf6')
    const smtpConfig = resolveOrgSmtpConfig(org)

    for (const to of emails) {
      await sendEmail({ to, subject: `${subject} — ${orgName}`, html, smtpConfig }).catch((err) => {
        console.error('[STAFF-NOTIFY] envío falló:', to, err)
      })
    }
  } catch (err) {
    console.error('[STAFF-NOTIFY]', err)
  }
}
