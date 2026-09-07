import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { claimCronRun } from '@/lib/idempotency'
import { resolveNotification } from '@/lib/notifications'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'
import { argentinaDayStart } from '@/lib/timezone'
import { diasHastaFin, CICLO_LABEL, type Ciclo } from '@/lib/servicios-recurrentes'
import { formatCurrency } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const JOB_NAME = 'contract-renewals'

// Días exactos antes del fin de contrato en los que se manda el aviso. Como el
// cron corre todos los días, un match exacto alcanza y no repite.
const AVISOS_DIAS = [30, 15, 7, 1]

// Aviso de contratos de servicios recurrentes por vencer. Opt-in: sólo sale
// para organizaciones que lo activaron en /configuracion/notificaciones.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'

  try {
    const db = prisma as any
    const today = argentinaDayStart()

    const orgs = await db.organization.findMany({
      select: {
        id: true, name: true, crmName: true, primaryColor: true, secondaryColor: true,
        smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
        smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
      },
    })

    let emailsSent = 0
    let orgsSkippedDisabled = 0
    let orgsSkippedNoEmail = 0
    let orgsSkippedNoRecipients = 0
    let orgsWithNothingToReport = 0
    let orgsSkippedAlreadySent = 0
    const wouldSend: { org: string; email: string; contratos: number }[] = []

    for (const org of orgs) {
      const notif = await resolveNotification(org.id, 'renewals')
      if (!notif.configured || !notif.enabled) { orgsSkippedDisabled++; continue }
      if (notif.emails.length === 0) { orgsSkippedNoRecipients++; continue }
      if (!isOrgEmailConfigured(org)) { orgsSkippedNoEmail++; continue }

      const abonos = await db.servicioRecurrente.findMany({
        where: { organizationId: org.id, estado: 'ACTIVO', contratoFin: { not: null } },
        select: {
          nombre: true, monto: true, moneda: true, ciclo: true, contratoFin: true,
          empresa: { select: { name: true } },
        },
      })

      const porVencer = abonos
        .map((a: any) => ({ ...a, dias: diasHastaFin(a.contratoFin, today) }))
        .filter((a: any) => a.dias !== null && AVISOS_DIAS.includes(a.dias))
        .sort((a: any, b: any) => a.dias - b.dias)

      if (porVencer.length === 0) { orgsWithNothingToReport++; continue }

      if (!dryRun && !(await claimCronRun(JOB_NAME, org.id, today))) { orgsSkippedAlreadySent++; continue }

      const lines = porVencer.map((a: any) => {
        const cuando = a.dias === 1 ? 'mañana' : `en ${a.dias} días`
        const monto = a.monto > 0 ? ` · ${formatCurrency(a.monto, a.moneda)} ${CICLO_LABEL[a.ciclo as Ciclo] ?? a.ciclo}` : ''
        return `• ${a.empresa?.name ?? 'Cliente'} — ${a.nombre} — vence ${cuando}${monto}`
      }).join('\n')

      const orgName = org.name || org.crmName || 'CRM'
      const html = buildEmailHtml(
        `${porVencer.length} contrato${porVencer.length !== 1 ? 's' : ''} por vencer`,
        `${lines}\n\nEntrá a Servicios en el CRM para renovarlos o darlos de baja.`,
        orgName,
        org.primaryColor || '#6366f1',
        org.secondaryColor || '#8b5cf6',
      )
      const subject = `${porVencer.length} contrato${porVencer.length !== 1 ? 's' : ''} por vencer — ${orgName}`

      for (const email of notif.emails) {
        if (dryRun) { wouldSend.push({ org: orgName, email, contratos: porVencer.length }); continue }
        try {
          await sendEmail({ to: email, subject, html, smtpConfig: resolveOrgSmtpConfig(org) })
          emailsSent++
        } catch (err) {
          console.error('[CRON CONTRACT-RENEWALS] Error enviando a', email, err)
        }
      }
    }

    return NextResponse.json({
      ok: true, dryRun,
      emailsSent, orgsSkippedDisabled, orgsSkippedNoEmail, orgsSkippedNoRecipients,
      orgsWithNothingToReport, orgsSkippedAlreadySent, orgsProcessed: orgs.length,
      ...(dryRun ? { wouldSend } : {}),
    })
  } catch (error) {
    console.error('[CRON CONTRACT-RENEWALS]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
