import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { claimCronRun } from '@/lib/idempotency'
import { resolveNotification } from '@/lib/notifications'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'
import { argentinaDayStart } from '@/lib/timezone'
import { diasHastaFin } from '@/lib/servicios-recurrentes'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const JOB_NAME = 'carnet-vencimiento'

// Días exactos antes del vencimiento del carnet en los que se manda el
// aviso — mismo criterio que contract-renewals/route.ts (de ahí está
// calcado casi literal: AVISOS_DIAS, idempotencia por CronRun, opt-in por
// NotificationSetting).
const AVISOS_DIAS = [30, 15, 7, 1]

// Aviso de carnet de vigilador por vencer (ABBA FISICA, legajos). Opt-in:
// sólo sale para organizaciones que lo activaron en
// /configuracion/notificaciones.
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
    const wouldSend: { org: string; email: string; vigiladores: number }[] = []

    for (const org of orgs) {
      const notif = await resolveNotification(org.id, 'carnet-vencimiento')
      if (!notif.configured || !notif.enabled) { orgsSkippedDisabled++; continue }
      if (notif.emails.length === 0) { orgsSkippedNoRecipients++; continue }
      if (!isOrgEmailConfigured(org)) { orgsSkippedNoEmail++; continue }

      const vigiladores = await db.vigilador.findMany({
        where: { organizationId: org.id, activo: true, carnetVencimiento: { not: null } },
        select: { nombre: true, apellido: true, carnetVencimiento: true },
      })

      const porVencer = vigiladores
        .map((v: any) => ({ ...v, dias: diasHastaFin(v.carnetVencimiento, today) }))
        .filter((v: any) => v.dias !== null && AVISOS_DIAS.includes(v.dias))
        .sort((a: any, b: any) => a.dias - b.dias)

      if (porVencer.length === 0) { orgsWithNothingToReport++; continue }

      if (!dryRun && !(await claimCronRun(JOB_NAME, org.id, today))) { orgsSkippedAlreadySent++; continue }

      const lines = porVencer.map((v: any) => {
        const cuando = v.dias === 1 ? 'mañana' : `en ${v.dias} días`
        return `• ${v.nombre} ${v.apellido} — carnet vence ${cuando}`
      }).join('\n')

      const orgName = org.name || org.crmName || 'CRM'
      const html = buildEmailHtml(
        `${porVencer.length} carnet${porVencer.length !== 1 ? 's' : ''} de vigilador por vencer`,
        `${lines}\n\nEntrá a Legajos en el CRM para gestionar la renovación.`,
        orgName,
        org.primaryColor || '#6366f1',
        org.secondaryColor || '#8b5cf6',
      )
      const subject = `${porVencer.length} carnet${porVencer.length !== 1 ? 's' : ''} de vigilador por vencer — ${orgName}`

      for (const email of notif.emails) {
        if (dryRun) { wouldSend.push({ org: orgName, email, vigiladores: porVencer.length }); continue }
        try {
          await sendEmail({ to: email, subject, html, smtpConfig: resolveOrgSmtpConfig(org) })
          emailsSent++
        } catch (err) {
          console.error('[CRON CARNET-VENCIMIENTO] Error enviando a', email, err)
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
    console.error('[CRON CARNET-VENCIMIENTO]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
