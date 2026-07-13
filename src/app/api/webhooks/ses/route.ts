import { NextRequest, NextResponse } from 'next/server'
import { createVerify } from 'crypto'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Only trust certs served from AWS SNS endpoints
const SNS_CERT_HOST = /^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com\//

// Simple in-process cert cache to avoid fetching on every request
const certCache = new Map<string, string>()

async function fetchCert(url: string): Promise<string> {
  if (certCache.has(url)) return certCache.get(url)!
  const res = await fetch(url)
  const cert = await res.text()
  certCache.set(url, cert)
  return cert
}

async function verifySnsSignature(body: Record<string, string>): Promise<boolean> {
  const certUrl = body.SigningCertURL
  if (!certUrl || !SNS_CERT_HOST.test(certUrl)) return false

  try {
    const cert = await fetchCert(certUrl)

    const isConfirm = body.Type === 'SubscriptionConfirmation'
    // Fields to sign — must be in this exact order per AWS SNS spec
    const fields = isConfirm
      ? ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type']
      : ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']

    const msg = fields
      .filter(f => body[f] !== undefined)
      .map(f => `${f}\n${body[f]}\n`)
      .join('')

    const verify = createVerify('RSA-SHA1')
    verify.update(msg)
    return verify.verify(cert, body.Signature, 'base64')
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Verify AWS SNS signature to prevent spoofed events
    const valid = await verifySnsSignature(body)
    if (!valid) {
      console.warn('[SES WEBHOOK] Invalid SNS signature — request rejected')
      return NextResponse.json({ ok: true }) // 200 to avoid SNS retry storm
    }

    // SNS subscription confirmation — only auto-confirm if TopicArn matches (when configured)
    if (body.Type === 'SubscriptionConfirmation' && body.SubscribeURL) {
      const expectedArn = process.env.AWS_SNS_TOPIC_ARN
      if (expectedArn && body.TopicArn !== expectedArn) {
        console.warn('[SES WEBHOOK] SubscriptionConfirmation TopicArn mismatch — ignored')
        return NextResponse.json({ ok: true })
      }
      await fetch(body.SubscribeURL)
      return NextResponse.json({ ok: true })
    }

    if (body.Type !== 'Notification') {
      return NextResponse.json({ ok: true })
    }

    let msg: Record<string, any>
    try { msg = JSON.parse(body.Message) }
    catch { return NextResponse.json({ ok: true }) }

    const eventType = msg.eventType as string | undefined
    const messageId = msg.mail?.messageId as string | undefined

    if (!eventType || !messageId) return NextResponse.json({ ok: true })

    const db = prisma as any

    const recipient = await db.campaignRecipient.findFirst({
      where: { messageId },
      select: { id: true, campaignId: true, openedAt: true },
    })

    if (!recipient) return NextResponse.json({ ok: true })

    if (eventType === 'Delivery') {
      try {
        await db.campaignRecipient.update({
          where: { id: recipient.id },
          data:  { deliveredAt: new Date() },
        })
        await db.emailCampaign.update({
          where: { id: recipient.campaignId },
          data:  { totalDelivered: { increment: 1 } },
        })
      } catch { /* columns not yet migrated */ }
    }

    if (eventType === 'Bounce') {
      const b = msg.bounce ?? {}
      try {
        await db.campaignRecipient.update({
          where: { id: recipient.id },
          data:  {
            status:       'bounced',
            bouncedAt:    new Date(),
            bounceType:    b.bounceType    ?? null,
            bounceSubType: b.bounceSubType ?? null,
          },
        })
        await db.emailCampaign.update({
          where: { id: recipient.campaignId },
          data:  { totalBounced: { increment: 1 } },
        })
      } catch { /* columns not yet migrated */ }
    }

    if (eventType === 'Complaint') {
      try {
        await db.campaignRecipient.update({
          where: { id: recipient.id },
          data:  { status: 'spam', spamAt: new Date() },
        })
        await db.emailCampaign.update({
          where: { id: recipient.campaignId },
          data:  { totalSpam: { increment: 1 } },
        })
      } catch { /* columns not yet migrated */ }
    }

    if (eventType === 'Open') {
      try {
        const first = !recipient.openedAt
        await db.campaignRecipient.update({
          where: { id: recipient.id },
          data:  { openedAt: recipient.openedAt ?? new Date(), openCount: { increment: 1 } },
        })
        if (first) {
          await db.emailCampaign.update({
            where: { id: recipient.campaignId },
            data:  { totalOpened: { increment: 1 } },
          })
        }
      } catch { /* columns not yet migrated */ }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[SES WEBHOOK]', err)
    return NextResponse.json({ ok: true }) // Always 200 — SNS will retry on non-2xx
  }
}
