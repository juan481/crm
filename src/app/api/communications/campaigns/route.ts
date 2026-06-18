import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendEmail, buildEmailHtml, type SmtpConfig } from '@/lib/email'

// ─── Personalization ──────────────────────────────────────────────────────────
// Replaces {{nombre}}, {{empresa}}, {{email}} (and any other {{key}}) with the
// recipient's actual data. Applied to both subject and body before each send.
function mergeVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

// ─── Batch sending ────────────────────────────────────────────────────────────
// Sends one at a time with EMAIL_DELAY between each to avoid SMTP/API rate limits.
// Every BATCH_SIZE emails, uses a longer BATCH_DELAY to let the relay recover.
const BATCH_SIZE    = 10
const BATCH_DELAY   = 3000  // ms — longer pause every N emails
const EMAIL_DELAY   =  800  // ms — pause between every individual send

interface Recipient {
  recipientId: string    // CampaignRecipient row id for status updates
  email:       string
  name:        string
  empresa:     string
}

async function sendBatched(opts: {
  recipients:    Recipient[]
  subjectTpl:    string
  bodyTpl:       string    // raw HTML from rich editor (with {{vars}})
  orgName:       string
  smtpConfig:    SmtpConfig | undefined
  campaignId:    string
}) {
  const { recipients, subjectTpl, bodyTpl, orgName, smtpConfig, campaignId } = opts
  const db = prisma as any

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i]
    const vars: Record<string, string> = {
      nombre:  r.name,
      empresa: r.empresa,
      email:   r.email,
    }
    const subject  = mergeVars(subjectTpl, vars)
    const bodyHtml = mergeVars(bodyTpl, vars)
    const html     = buildEmailHtml(subject, bodyHtml, orgName)

    try {
      await sendEmail({ to: r.email, subject, html, smtpConfig })
      await db.campaignRecipient.update({
        where: { id: r.recipientId },
        data:  { status: 'sent', sentAt: new Date() },
      })
    } catch (err) {
      await db.campaignRecipient.update({
        where: { id: r.recipientId },
        data:  { status: 'failed', error: String((err as Error).message).slice(0, 250) },
      })
    }

    // Pause between every email; longer pause every BATCH_SIZE to let relay recover
    if (i + 1 < recipients.length) {
      const delay = (i + 1) % BATCH_SIZE === 0 ? BATCH_DELAY : EMAIL_DELAY
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  // Set final campaign status based on recipient outcomes
  const results = await db.campaignRecipient.groupBy({
    by:    ['status'],
    where: { campaignId },
    _count: true,
  })
  const sentCount   = results.find((r: any) => r.status === 'sent')?._count   ?? 0
  const failedCount = results.find((r: any) => r.status === 'failed')?._count ?? 0

  const finalStatus = sentCount === 0 ? 'FAILED' : 'SENT'
  await db.emailCampaign.update({
    where: { id: campaignId },
    data:  { status: finalStatus, sentAt: new Date() },
  })

  console.log(`[CAMPAIGN ${campaignId}] Done: ${sentCount} sent, ${failedCount} failed`)
}

// ─── GET /api/communications/campaigns ───────────────────────────────────────
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const campaigns = await prisma.emailCampaign.findMany({
      where:   { organizationId: payload.orgId },
      include: { _count: { select: { recipients: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: campaigns })
  } catch (error) {
    console.error('[CAMPAIGNS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ─── POST /api/communications/campaigns ──────────────────────────────────────
// Body: {
//   name:       string
//   subject:    string           — may contain {{nombre}}, {{empresa}}, {{email}}
//   body:       string           — rich HTML, may contain same vars
//   recipients: { email: string; name: string; empresa?: string }[]
//   sendNow:    boolean
// }
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { name, subject, body, recipients, sendNow } = await req.json() as {
      name:       string
      subject:    string
      body:       string
      recipients: Array<{ email: string; name: string; empresa?: string }>
      sendNow:    boolean
    }

    if (!name || !subject || !body)
      return NextResponse.json({ error: 'Nombre, asunto y cuerpo son requeridos' }, { status: 400 })
    if (!recipients?.length)
      return NextResponse.json({ error: 'Seleccioná al menos un destinatario' }, { status: 400 })

    // Deduplicate by email (case-insensitive)
    const seen   = new Set<string>()
    const unique = recipients.filter(r => {
      const key = r.email.toLowerCase().trim()
      if (!key || seen.has(key)) return false
      seen.add(key); return true
    })

    const org = await prisma.organization.findUnique({
      where:  { id: payload.orgId },
      select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true, crmName: true },
    })

    if (sendNow && (!org?.smtpHost || !org?.smtpUser || !org?.smtpPass)) {
      return NextResponse.json(
        { error: 'Configurá el servidor de email en Configuración → Email antes de enviar campañas.' },
        { status: 400 }
      )
    }

    const smtpConfig: SmtpConfig | undefined = org?.smtpHost
      ? { host: org.smtpHost, port: org.smtpPort ?? 587, user: org.smtpUser ?? '', pass: org.smtpPass ?? '', from: org.smtpFrom ?? org.smtpUser ?? '' }
      : undefined

    const db = prisma as any

    // Create campaign + recipients
    const campaign = await db.emailCampaign.create({
      data: {
        name,
        subject,
        body,
        status:         sendNow ? 'SENDING' : 'DRAFT',
        organizationId: payload.orgId,
        recipients: {
          create: unique.map(r => ({ email: r.email.trim(), name: r.name.trim() })),
        },
      },
      include: {
        _count:     { select: { recipients: true } },
        recipients: { select: { id: true, email: true } },
      },
    })

    // Return immediately, send async
    if (sendNow && unique.length > 0) {
      const recipientRows: Recipient[] = campaign.recipients.map((row: any) => {
        const match = unique.find(u => u.email.toLowerCase() === row.email.toLowerCase())
        return {
          recipientId: row.id,
          email:       row.email,
          name:        match?.name    ?? row.email,
          empresa:     match?.empresa ?? '',
        }
      })

      sendBatched({
        recipients: recipientRows,
        subjectTpl: subject,
        bodyTpl:    body,
        orgName:    org?.crmName ?? 'CRM Pro',
        smtpConfig,
        campaignId: campaign.id,
      }).catch(err => {
        console.error('[CAMPAIGN SEND FATAL]', err)
        db.emailCampaign.update({ where: { id: campaign.id }, data: { status: 'FAILED' } }).catch(() => {})
      })
    }

    return NextResponse.json({
      data: { ...campaign, recipients: undefined }   // strip recipients array from response
    }, { status: 201 })
  } catch (error) {
    console.error('[CAMPAIGNS POST]', error)
    return NextResponse.json({ error: 'Error al crear campaña' }, { status: 500 })
  }
}
