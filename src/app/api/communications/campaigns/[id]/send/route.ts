import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendEmail, buildEmailHtml, type SmtpConfig } from '@/lib/email'

export const dynamic = 'force-dynamic'

const BATCH = 5 // emails per call — stays well within Vercel's timeout

function mergeVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

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

    // Build smtp config based on provider
    let smtpConfig: SmtpConfig | undefined
    if (org.smtpProvider === 'SES') {
      smtpConfig = {
        provider: 'SES',
        host: '', port: 587, user: '', pass: '',
        from: org.sesFrom ?? '',
        sesRegion: org.sesRegion ?? '',
        sesAccessKeyId: org.sesAccessKeyId ?? '',
        sesSecretKey: org.sesSecretKey ?? '',
        sesConfigSet: org.sesConfigSet ?? undefined,
      }
    } else if (org.smtpHost) {
      smtpConfig = {
        host: org.smtpHost,
        port: org.smtpPort ?? 587,
        user: org.smtpUser ?? '',
        pass: org.smtpPass ?? '',
        from: org.smtpFrom ?? org.smtpUser ?? '',
      }
    }

    // Tracking pixel base URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

    // Fetch next batch of pending recipients
    const pending = await db.campaignRecipient.findMany({
      where:   { campaignId: params.id, status: 'pending' },
      take:    BATCH,
      select:  { id: true, email: true, name: true },
    })

    let sent   = 0
    let failed = 0

    for (const r of pending) {
      const vars = { nombre: r.name ?? r.email, empresa: '', email: r.email }
      const subject  = mergeVars(campaign.subject, vars)
      const bodyHtml = mergeVars(campaign.body,    vars)

      // Inject tracking pixel if we have an app URL
      const pixelUrl = appUrl ? `${appUrl}/api/track/open?rid=${r.id}` : undefined
      const html = buildEmailHtml(
        subject, bodyHtml,
        org.crmName ?? 'CRM',
        org.primaryColor ?? '#6366f1',
        org.secondaryColor ?? '#8b5cf6',
        pixelUrl,
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

    return NextResponse.json({ sent, failed, remaining, done: remaining === 0 })
  } catch (error) {
    console.error('[CAMPAIGN SEND BATCH]', error)
    return NextResponse.json({ error: 'Error al enviar lote' }, { status: 500 })
  }
}
