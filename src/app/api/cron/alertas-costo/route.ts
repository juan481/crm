import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { claimCronRun } from '@/lib/idempotency'
import { resolveNotification } from '@/lib/notifications'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'
import { argentinaDayStart } from '@/lib/timezone'
import { formatMoneyExact } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const JOB_NAME = 'alertas-costo'

// Digest diario de alertas de cambio de costo pendientes. Opt-in vía
// /configuracion/notificaciones. Mismo patrón que stock-bajo / contract-renewals.
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
    const wouldSend: { org: string; email: string; alertas: number }[] = []

    for (const org of orgs) {
      const notif = await resolveNotification(org.id, 'alertas-costo')
      if (!notif.configured || !notif.enabled) { orgsSkippedDisabled++; continue }
      if (notif.emails.length === 0) { orgsSkippedNoRecipients++; continue }
      if (!isOrgEmailConfigured(org)) { orgsSkippedNoEmail++; continue }

      const alertas = await db.alertaCosto.findMany({
        where: { organizationId: org.id, estado: 'PENDIENTE' },
        orderBy: { createdAt: 'desc' },
        select: {
          costoAnterior: true, costoNuevo: true, variacionPct: true, origen: true, nota: true,
          product: { select: { name: true, sku: true, currency: true } },
        },
      })
      if (alertas.length === 0) { orgsWithNothingToReport++; continue }

      if (!dryRun && !(await claimCronRun(JOB_NAME, org.id, today))) { orgsSkippedAlreadySent++; continue }

      const sospechosas = alertas.filter((a: any) => a.nota).length
      const lines = alertas.slice(0, 40).map((a: any) => {
        const cur = a.product?.currency || 'ARS'
        const flecha = a.costoNuevo > a.costoAnterior ? '▲' : '▼'
        const origen = a.origen === 'COMPRA' ? 'compra' : 'catálogo'
        const flag = a.nota ? ' ⚠ revisar (posible error de moneda/carga)' : ''
        return `• ${a.product?.name ?? 'Producto'} — ${formatMoneyExact(a.costoAnterior, cur)} → ${formatMoneyExact(a.costoNuevo, cur)} ${flecha} ${a.variacionPct > 0 ? '+' : ''}${a.variacionPct}% (${origen})${flag}`
      }).join('\n')
      const extra = alertas.length > 40 ? `\n…y ${alertas.length - 40} más.` : ''

      const orgName = org.name || org.crmName || 'CRM'
      const aviso = sospechosas > 0
        ? `\n\n${sospechosas} de estas tienen una variación rara (probable mezcla de monedas o error en la planilla del proveedor) — están marcadas con ⚠ y NO se aplicaron.`
        : ''
      const html = buildEmailHtml(
        `${alertas.length} alerta${alertas.length !== 1 ? 's' : ''} de costo pendiente${alertas.length !== 1 ? 's' : ''}`,
        `${lines}${extra}${aviso}\n\nEntrá a Depósito → Stock → Alertas en el CRM para aplicarlas o descartarlas.`,
        orgName,
        org.primaryColor || '#6366f1',
        org.secondaryColor || '#8b5cf6',
      )
      const subject = `${alertas.length} alerta${alertas.length !== 1 ? 's' : ''} de costo — ${orgName}`

      for (const email of notif.emails) {
        if (dryRun) { wouldSend.push({ org: orgName, email, alertas: alertas.length }); continue }
        try {
          await sendEmail({ to: email, subject, html, smtpConfig: resolveOrgSmtpConfig(org) })
          emailsSent++
        } catch (err) {
          console.error('[CRON ALERTAS-COSTO] Error enviando a', email, err)
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
    console.error('[CRON ALERTAS-COSTO]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
