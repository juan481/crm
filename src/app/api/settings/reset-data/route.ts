import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

// DELETE all business data for the org (SUPER_ADMIN only)
// Preserves: organization settings, users, services, branding
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Solo el Super Admin puede resetear los datos' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    if (body.confirm !== 'RESETEAR') {
      return NextResponse.json(
        { error: 'Confirmación requerida: enviá { "confirm": "RESETEAR" }' },
        { status: 400 },
      )
    }

    const orgId = payload.orgId

    // Delete in dependency order
    await prisma.$transaction([
      prisma.ticketMessage.deleteMany({ where: { ticket: { organizationId: orgId } } }),
      prisma.ticket.deleteMany({ where: { organizationId: orgId } }),
      prisma.task.deleteMany({ where: { organizationId: orgId } }),
      prisma.campaignRecipient.deleteMany({ where: { campaign: { organizationId: orgId } } }),
      prisma.emailCampaign.deleteMany({ where: { organizationId: orgId } }),
      prisma.emailTemplate.deleteMany({ where: { organizationId: orgId } }),
      prisma.deal.deleteMany({ where: { organizationId: orgId } }),
      prisma.activityLog.deleteMany({ where: { client: { organizationId: orgId } } }),
      prisma.note.deleteMany({ where: { client: { organizationId: orgId } } }),
      prisma.sale.deleteMany({ where: { client: { organizationId: orgId } } }),
      prisma.invoice.deleteMany({ where: { client: { organizationId: orgId } } }),
      prisma.contact.deleteMany({ where: { client: { organizationId: orgId } } }),
      prisma.client.deleteMany({ where: { organizationId: orgId } }),
      prisma.eventAttendee.deleteMany({ where: { event: { organizationId: orgId } } }),
      prisma.event.deleteMany({ where: { organizationId: orgId } }),
      prisma.document.deleteMany({ where: { organizationId: orgId } }),
      prisma.folder.deleteMany({ where: { organizationId: orgId } }),
    ])

    return NextResponse.json({ message: 'Datos eliminados correctamente. El sistema está listo.' })
  } catch (error) {
    console.error('[RESET DATA]', error)
    return NextResponse.json({ error: 'Error al resetear datos' }, { status: 500 })
  }
}
