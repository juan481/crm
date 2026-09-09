import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { claimCronRun } from '@/lib/idempotency'
import { resolveNotification } from '@/lib/notifications'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'
import { argentinaDayStart } from '@/lib/timezone'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const JOB_NAME = 'stock-bajo'

// Aviso diario de productos del depósito con stock en o por debajo del mínimo.
// Opt-in: sólo sale para organizaciones que lo activaron en
// /configuracion/notificaciones. Mismo patrón que contract-renewals.
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
    const wouldSend: { org: string; email: string; productos: number }[] = []

    for (const org of orgs) {
      const notif = await resolveNotification(org.id, 'stock-bajo')
      if (!notif.configured || !notif.enabled) { orgsSkippedDisabled++; continue }
      if (notif.emails.length === 0) { orgsSkippedNoRecipients++; continue }
      if (!isOrgEmailConfigured(org)) { orgsSkippedNoEmail++; continue }

      // Prisma no compara dos columnas entre sí — se trae el universo con
      // mínimo definido y se filtra stock <= mínimo en memoria.
      const conMinimo = await db.product.findMany({
        where: { organizationId: org.id, trackStock: true, stockMinimo: { not: null } },
        select: { name: true, sku: true, stock: true, stockMinimo: true, unit: true },
      })
      const bajos = conMinimo
        .filter((p: any) => p.stock <= p.stockMinimo)
        .sort((a: any, b: any) => (a.stock - a.stockMinimo) - (b.stock - b.stockMinimo))

      if (bajos.length === 0) { orgsWithNothingToReport++; continue }

      if (!dryRun && !(await claimCronRun(JOB_NAME, org.id, today))) { orgsSkippedAlreadySent++; continue }

      const lines = bajos.map((p: any) => {
        const sku = p.sku ? ` (${p.sku})` : ''
        const estado = p.stock <= 0 ? 'SIN STOCK' : `${p.stock} ${p.unit}`
        return `• ${p.name}${sku} — ${estado} · mínimo ${p.stockMinimo}`
      }).join('\n')

      const orgName = org.name || org.crmName || 'CRM'
      const html = buildEmailHtml(
        `${bajos.length} producto${bajos.length !== 1 ? 's' : ''} bajo mínimo`,
        `${lines}\n\nEntrá a Depósito → Stock en el CRM para reponer.`,
        orgName,
        org.primaryColor || '#6366f1',
        org.secondaryColor || '#8b5cf6',
      )
      const subject = `${bajos.length} producto${bajos.length !== 1 ? 's' : ''} bajo mínimo — ${orgName}`

      for (const email of notif.emails) {
        if (dryRun) { wouldSend.push({ org: orgName, email, productos: bajos.length }); continue }
        try {
          await sendEmail({ to: email, subject, html, smtpConfig: resolveOrgSmtpConfig(org) })
          emailsSent++
        } catch (err) {
          console.error('[CRON STOCK-BAJO] Error enviando a', email, err)
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
    console.error('[CRON STOCK-BAJO]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
