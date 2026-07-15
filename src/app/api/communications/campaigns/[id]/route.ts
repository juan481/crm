import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER'))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const campaign = await db.emailCampaign.findFirst({
      where:  { id: params.id, organizationId: payload.orgId },
      include: {
        recipients: {
          select: { id: true, email: true, status: true, sentAt: true, error: true },
          orderBy: { email: 'asc' },
        },
      },
    })

    if (!campaign) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    return NextResponse.json({ data: campaign })
  } catch (error) {
    console.error('[CAMPAIGN GET ID]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN'))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const existing = await db.emailCampaign.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true, status: true },
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    if (existing.status !== 'DRAFT')
      return NextResponse.json({ error: 'Solo se pueden editar campañas en borrador' }, { status: 409 })

    const { name, subject, body } = await req.json()
    const campaign = await db.emailCampaign.update({
      where: { id: params.id },
      data: {
        ...(name    && { name }),
        ...(subject && { subject }),
        ...(body    && { body }),
      },
      select: { id: true, name: true, subject: true, status: true },
    })
    return NextResponse.json({ data: campaign })
  } catch (error) {
    console.error('[CAMPAIGN PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN'))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const existing = await db.emailCampaign.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true, status: true },
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    if (existing.status !== 'DRAFT')
      return NextResponse.json({ error: 'Solo se pueden eliminar campañas en borrador' }, { status: 409 })

    await db.emailCampaign.delete({ where: { id: params.id } })
    return NextResponse.json({ message: 'Campaña eliminada' })
  } catch (error) {
    console.error('[CAMPAIGN DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
