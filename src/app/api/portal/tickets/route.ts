import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPortalUser } from '@/lib/auth'
import { SLA_HOURS } from '@/lib/tickets'
import { fireWebhook } from '@/lib/webhooks'
import {
  sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured,
} from '@/lib/email'

export const dynamic = 'force-dynamic'

const CATEGORIES = ['SOPORTE', 'FACTURACION', 'CONSULTA'] as const
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// GET: tickets abiertos/cerrados de la Empresa del usuario de portal.
export async function GET() {
  const portal = await getPortalUser()
  if (!portal) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const tickets = await prisma.ticket.findMany({
    where: { organizationId: portal.orgId, empresaId: portal.empresaId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true, number: true, title: true, status: true, category: true, priority: true,
      createdAt: true, updatedAt: true, resolvedAt: true,
      _count: { select: { messages: true } },
    },
  })

  return NextResponse.json({ data: tickets })
}

// POST: el cliente abre un ticket. createdById se atribuye al SUPER_ADMIN más
// antiguo (mismo criterio que el formulario público de tickets — TicketMessage
// .userId y Ticket.createdById siguen no-nulos); la identidad real queda en
// recipientEmail/recipientName y en empresaId (forzado del portal, nunca del body).
export async function POST(req: NextRequest) {
  const portal = await getPortalUser()
  if (!portal) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const description = typeof body?.description === 'string' ? body.description.trim() : ''
  const category = CATEGORIES.includes(body?.category) ? body.category : 'SOPORTE'
  if (!title || !description) {
    return NextResponse.json({ error: 'Asunto y detalle son requeridos' }, { status: 400 })
  }

  const [admin, portalUser] = await Promise.all([
    prisma.user.findFirst({
      where: { organizationId: portal.orgId, role: 'SUPER_ADMIN', status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }),
    prisma.user.findUnique({ where: { id: portal.userId }, select: { name: true } }),
  ])
  if (!admin) return NextResponse.json({ error: 'No se pudo procesar la solicitud' }, { status: 500 })

  let ticket: { id: string; number: number } | null = null
  for (let attempt = 0; attempt < 5 && !ticket; attempt++) {
    const last = await prisma.ticket.findFirst({
      where: { organizationId: portal.orgId },
      orderBy: { number: 'desc' },
      select: { number: true },
    })
    try {
      ticket = await prisma.ticket.create({
        data: {
          title, description,
          priority: 'MEDIA',
          category,
          empresaId: portal.empresaId,
          recipientEmail: portal.email,
          recipientName: portalUser?.name ?? portal.email,
          createdById: admin.id,
          organizationId: portal.orgId,
          slaDueAt: new Date(Date.now() + SLA_HOURS.MEDIA * 60 * 60 * 1000),
          number: (last?.number ?? 0) + 1,
        },
        select: { id: true, number: true },
      })
    } catch (err: unknown) {
      const code = typeof err === 'object' && err && 'code' in err ? (err as { code?: string }).code : undefined
      if (code !== 'P2002' || attempt === 4) throw err
    }
  }
  if (!ticket) return NextResponse.json({ error: 'Error al crear el ticket' }, { status: 500 })

  await prisma.ticketMessage.create({
    data: { ticketId: ticket.id, content: description, isInternal: false, userId: admin.id },
  })

  fireWebhook(portal.orgId, 'ticket.created', {
    id: ticket.id, number: ticket.number, title, priority: 'MEDIA', category, source: 'portal_cliente',
  })

  // Aviso al staff.
  try {
    const org = await prisma.organization.findUnique({
      where: { id: portal.orgId },
      select: {
        name: true, crmName: true, primaryColor: true, secondaryColor: true,
        smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
        smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
      },
    })
    if (org && isOrgEmailConfigured(org)) {
      const orgName = org.name || org.crmName || 'CRM'
      const empresa = await prisma.empresa.findUnique({ where: { id: portal.empresaId }, select: { name: true } })
      const staff = await prisma.user.findMany({
        where: { organizationId: portal.orgId, status: 'ACTIVE', role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
        select: { email: true },
      })
      const html = buildEmailHtml(
        `Nuevo ticket del portal — #${String(ticket.number).padStart(4, '0')}`,
        `${escapeHtml(empresa?.name ?? 'Un cliente')} abrió el ticket "${escapeHtml(title)}" desde el portal.\n\nEntrá al CRM para responder.`,
        orgName, org.primaryColor || '#6366f1', org.secondaryColor || '#8b5cf6',
      )
      for (const s of staff) {
        if (!s.email) continue
        await sendEmail({ to: s.email, subject: `Nuevo ticket del portal #${String(ticket.number).padStart(4, '0')} — ${orgName}`, html, smtpConfig: resolveOrgSmtpConfig(org) })
      }
    }
  } catch (err) {
    console.error('[PORTAL TICKET] aviso al staff falló:', err)
  }

  return NextResponse.json({ data: { id: ticket.id, number: ticket.number } }, { status: 201 })
}
