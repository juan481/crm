import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isOrgEmailConfigured } from '@/lib/email'
import { filterSuppressed } from '@/lib/suppression'
import { getEmailUsage } from '@/lib/email-usage'

export const dynamic = 'force-dynamic'

// ─── GET /api/communications/campaigns ───────────────────────────────────────
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER'))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const campaigns = await prisma.emailCampaign.findMany({
      where:   { organizationId: payload.orgId },
      include: { _count: { select: { recipients: true } } },
      orderBy: { createdAt: 'desc' },
    })

    // Conteo de "realmente enviados" (status='sent') por campaña, aparte
    // del `_count.recipients` de arriba (destinatarios TOTALES, cualquier
    // status) — la tarjeta de stats de la lista sumaba ese total de todas
    // las campañas sin filtrar, contando de más una campaña en DRAFT
    // (nunca enviada) o filas pending/failed como si fueran "enviadas".
    // Prisma no permite dos _count distintos sobre la misma relación en un
    // solo select, así que va aparte y se mergea acá.
    const sentGroups = await (prisma as any).campaignRecipient.groupBy({
      by: ['campaignId'],
      where: { campaignId: { in: campaigns.map(c => c.id) }, status: 'sent' },
      _count: { _all: true },
    })
    const sentByCampaign = new Map(sentGroups.map((g: any) => [g.campaignId, g._count._all]))
    const data = campaigns.map(c => ({ ...c, sentCount: sentByCampaign.get(c.id) ?? 0 }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[CAMPAIGNS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ─── POST /api/communications/campaigns ──────────────────────────────────────
// Creates the campaign and recipients. Sending is triggered client-side via
// POST /api/communications/campaigns/[id]/send (batched to stay within timeouts).
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

    // Drop anyone who unsubscribed from this org's emails before
    const { allowed, suppressed } = await filterSuppressed(payload.orgId, unique)

    if (sendNow) {
      const org = await prisma.organization.findUnique({
        where:  { id: payload.orgId },
        select: {
          smtpHost: true, smtpUser: true, smtpPass: true,
          smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true,
        },
      })
      if (!isOrgEmailConfigured(org)) {
        return NextResponse.json(
          { error: 'Configurá el servidor de email en Configuración → Email antes de enviar campañas.' },
          { status: 400 }
        )
      }

      const quota = await getEmailUsage(payload.orgId)
      if (quota.remaining <= 0) {
        return NextResponse.json({
          error: 'Alcanzaste el límite mensual de envíos de email. Solicitá un aumento para seguir enviando campañas.',
          quotaExceeded: true,
          used: quota.used, limit: quota.limit,
        }, { status: 429 })
      }
    }

    if (allowed.length === 0) {
      return NextResponse.json(
        { error: `Los ${suppressed.length} destinatarios seleccionados se dieron de baja anteriormente y no se les puede volver a escribir.` },
        { status: 400 },
      )
    }

    const db = prisma as any

    const campaign = await db.emailCampaign.create({
      data: {
        name,
        subject,
        body,
        status:         sendNow ? 'SENDING' : 'DRAFT',
        organizationId: payload.orgId,
        recipients: {
          create: allowed.map(r => ({ email: r.email.trim(), name: r.name.trim() })),
        },
      },
      select: { id: true, name: true, status: true, _count: { select: { recipients: true } } },
    })

    return NextResponse.json({
      data: campaign,
      skippedUnsubscribed: suppressed.length,
    }, { status: 201 })
  } catch (error) {
    console.error('[CAMPAIGNS POST]', error)
    return NextResponse.json({ error: 'Error al crear campaña' }, { status: 500 })
  }
}
