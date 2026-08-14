import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig } from '@/lib/email'
import { getSuppressedSet } from '@/lib/suppression'
import { getEmailUsage, incrementEmailUsage } from '@/lib/email-usage'

export const dynamic = 'force-dynamic'

const BATCH = 5 // emails per call — stays well within Vercel's timeout

function mergeVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN'))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any

    // Load campaign + org config in one shot
    const campaign = await db.emailCampaign.findFirst({
      where:  { id: params.id, organizationId: payload.orgId },
      select: {
        id: true, subject: true, body: true, status: true,
        organization: {
          select: {
            crmName: true, primaryColor: true, secondaryColor: true,
            smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
            smtpProvider: true,
            sesRegion: true, sesAccessKeyId: true, sesSecretKey: true,
            sesFrom: true, sesConfigSet: true,
          },
        },
      },
    })

    if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
    if (campaign.status === 'SENT') return NextResponse.json({ sent: 0, failed: 0, remaining: 0, done: true })

    const org = campaign.organization
    const smtpConfig = resolveOrgSmtpConfig(org)

    // Quota check — only campaign sends count toward this. If there's no
    // room left at all, stop before touching anything else in this batch.
    const quota = await getEmailUsage(payload.orgId)
    if (quota.remaining <= 0) {
      const remainingPending = await db.campaignRecipient.count({
        where: { campaignId: params.id, status: 'pending' },
      })
      return NextResponse.json({
        sent: 0, failed: 0, suppressed: 0, remaining: remainingPending, done: false,
        quotaExceeded: true, quota: { used: quota.used, limit: quota.limit },
      })
    }

    // Tracking pixel base URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

    // Auto-recuperación: una fila puede quedar "sending" para siempre si un
    // request anterior murió a mitad de camino (timeout de Vercel, crash) —
    // sin esto, esos destinatarios no se reenviaban nunca más (ni aparecían
    // en `pending`, así que "Reenviar pendientes" los ignoraba). 3 minutos
    // es sobra de margen: un batch de 5 emails tarda segundos, no minutos.
    await db.campaignRecipient.updateMany({
      where: { campaignId: params.id, status: 'sending', updatedAt: { lt: new Date(Date.now() - 3 * 60 * 1000) } },
      data:  { status: 'pending' },
    })

    // Fetch next batch of pending recipients, capped to whatever quota allows
    const takeCount = Math.min(BATCH, quota.remaining)
    const candidates = await db.campaignRecipient.findMany({
      where:   { campaignId: params.id, status: 'pending' },
      take:    takeCount,
      select:  { id: true },
    })

    // Claim atómico: sólo las filas que EN ESTE MOMENTO siguen en 'pending'
    // pasan a 'sending'. Si dos requests concurrentes (dos pestañas, doble
    // click en "Reenviar pendientes") leyeron el mismo batch, Postgres
    // serializa el UPDATE fila por fila — sólo uno de los dos logra
    // reclamar cada fila, el otro se queda con count menor (o 0) y no
    // reenvía nada de lo que el primero ya se llevó. Antes ambos mandaban
    // el mismo email dos veces y descontaban cupo dos veces.
    let pending: { id: string; email: string; name: string | null }[] = []
    if (candidates.length > 0) {
      const claim = await db.campaignRecipient.updateMany({
        where: { id: { in: candidates.map((c: { id: string }) => c.id) }, status: 'pending' },
        data:  { status: 'sending' },
      })
      if (claim.count > 0) {
        pending = await db.campaignRecipient.findMany({
          where:  { id: { in: candidates.map((c: { id: string }) => c.id) }, status: 'sending' },
          select: { id: true, email: true, name: true },
        })
      }
    }

    // Re-check suppression right before sending — someone may have unsubscribed
    // since this campaign's recipients were created (batching a large list can
    // take a while), so this catches it even if the creation-time filter didn't.
    const suppressedSet = await getSuppressedSet(payload.orgId, pending.map((r: { email: string }) => r.email))

    let sent       = 0
    let failed     = 0
    let suppressed = 0

    for (const r of pending) {
      if (suppressedSet.has(r.email.trim().toLowerCase())) {
        await db.campaignRecipient.update({ where: { id: r.id }, data: { status: 'suppressed' } })
        suppressed++
        continue
      }

      const vars = { nombre: r.name ?? r.email, empresa: '', email: r.email }
      const subject  = mergeVars(campaign.subject, vars)
      const bodyHtml = mergeVars(campaign.body,    vars)

      // Inject tracking pixel + unsubscribe link if we have an app URL
      const pixelUrl       = appUrl ? `${appUrl}/api/track/open?rid=${r.id}` : undefined
      const unsubscribeUrl = appUrl ? `${appUrl}/unsubscribe/${r.id}` : undefined
      const html = buildEmailHtml(
        subject, bodyHtml,
        org.crmName ?? 'CRM',
        org.primaryColor ?? '#6366f1',
        org.secondaryColor ?? '#8b5cf6',
        pixelUrl,
        unsubscribeUrl,
      )

      try {
        const { messageId } = await sendEmail({ to: r.email, subject, html, smtpConfig })

        // Always mark as sent
        await db.campaignRecipient.update({
          where: { id: r.id },
          data:  { status: 'sent', sentAt: new Date() },
        })

        // Store messageId for webhook correlation (requires migration)
        if (messageId) {
          try {
            await db.campaignRecipient.update({
              where: { id: r.id },
              data:  { messageId },
            })
          } catch { /* column not yet migrated — safe to ignore */ }
        }

        await incrementEmailUsage(payload.orgId, 1)
        sent++
      } catch (err) {
        await db.campaignRecipient.update({
          where: { id: r.id },
          data:  { status: 'failed', error: String((err as Error).message).slice(0, 250) },
        })
        failed++
      }
    }

    // Count remaining pending after this batch
    const remaining = await db.campaignRecipient.count({
      where: { campaignId: params.id, status: 'pending' },
    })

    if (remaining === 0) {
      const sentTotal = await db.campaignRecipient.count({ where: { campaignId: params.id, status: 'sent' } })
      const finalStatus = sentTotal > 0 ? 'SENT' : 'FAILED'
      await db.emailCampaign.update({ where: { id: params.id }, data: { status: finalStatus, sentAt: new Date() } })
    }

    // Ran out of quota mid-batch: there's still pending work, but no room left
    // this month. Campaign stays SENDING — "Reenviar pendientes" already
    // picks it back up once the limit resets or the agency raises it.
    const quotaExceeded = remaining > 0 && (quota.remaining - sent) <= 0

    return NextResponse.json({
      sent, failed, suppressed, remaining, done: remaining === 0,
      ...(quotaExceeded ? { quotaExceeded: true, quota: { used: quota.used + sent, limit: quota.limit } } : {}),
    })
  } catch (error) {
    console.error('[CAMPAIGN SEND BATCH]', error)
    return NextResponse.json({ error: 'Error al enviar lote' }, { status: 500 })
  }
}
