import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendEmail, buildEmailHtml, type SmtpConfig } from '@/lib/email'

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const campaigns = await prisma.emailCampaign.findMany({
      where: { organizationId: payload.orgId },
      include: { _count: { select: { recipients: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: campaigns })
  } catch (error) {
    console.error('[CAMPAIGNS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { name, subject, body, recipientIds, sendNow } = await req.json()
    if (!name || !subject || !body) {
      return NextResponse.json({ error: 'Nombre, asunto y cuerpo son requeridos' }, { status: 400 })
    }

    // Fetch org SMTP config and branding in parallel
    const [org, clients] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: payload.orgId },
        select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true, crmName: true },
      }),
      recipientIds?.length > 0
        ? prisma.client.findMany({
            where: { id: { in: recipientIds }, organizationId: payload.orgId },
            select: { email: true, name: true },
          })
        : Promise.resolve([]),
    ])

    if (sendNow && (!org?.smtpHost || !org?.smtpUser || !org?.smtpPass)) {
      return NextResponse.json(
        { error: 'Configurá el servidor de email en Configuración → Email antes de enviar campañas.' },
        { status: 400 }
      )
    }

    const smtpConfig: SmtpConfig | undefined = org?.smtpHost
      ? {
          host: org.smtpHost,
          port: org.smtpPort ?? 587,
          user: org.smtpUser ?? '',
          pass: org.smtpPass ?? '',
          from: org.smtpFrom ?? org.smtpUser ?? '',
        }
      : undefined

    const campaign = await prisma.emailCampaign.create({
      data: {
        name,
        subject,
        body,
        status: sendNow ? 'SENDING' : 'DRAFT',
        organizationId: payload.orgId,
        recipients: {
          create: (clients as { email: string; name: string }[]).map((r) => ({ email: r.email, name: r.name })),
        },
      },
      include: { _count: { select: { recipients: true } } },
    })

    if (sendNow && clients.length > 0) {
      const html = buildEmailHtml(subject, body, org?.crmName ?? 'CRM Pro')
      Promise.allSettled(
        (clients as { email: string; name: string }[]).map((r) =>
          sendEmail({ to: r.email, subject, html, smtpConfig })
        )
      ).then(async (results) => {
        const failed = results.filter((r) => r.status === 'rejected').length
        await prisma.emailCampaign.update({
          where: { id: campaign.id },
          data: {
            status: failed === results.length ? 'FAILED' : 'SENT',
            sentAt: new Date(),
          },
        })
      }).catch((err) => {
        console.error('[CAMPAIGN SEND]', err)
        prisma.emailCampaign.update({
          where: { id: campaign.id },
          data: { status: 'FAILED' },
        }).catch(() => {})
      })
    }

    return NextResponse.json({ data: campaign }, { status: 201 })
  } catch (error) {
    console.error('[CAMPAIGNS POST]', error)
    return NextResponse.json({ error: 'Error al crear campaña' }, { status: 500 })
  }
}
