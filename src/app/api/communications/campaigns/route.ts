import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

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

    return NextResponse.json({ data: campaigns })
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

    if (sendNow) {
      const org = await prisma.organization.findUnique({
        where:  { id: payload.orgId },
        select: { smtpHost: true, smtpUser: true, smtpPass: true },
      })
      if (!org?.smtpHost || !org?.smtpUser || !org?.smtpPass) {
        return NextResponse.json(
          { error: 'Configurá el servidor de email en Configuración → Email antes de enviar campañas.' },
          { status: 400 }
        )
      }
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
          create: unique.map(r => ({ email: r.email.trim(), name: r.name.trim() })),
        },
      },
      select: { id: true, name: true, status: true, _count: { select: { recipients: true } } },
    })

    return NextResponse.json({ data: campaign }, { status: 201 })
  } catch (error) {
    console.error('[CAMPAIGNS POST]', error)
    return NextResponse.json({ error: 'Error al crear campaña' }, { status: 500 })
  }
}
