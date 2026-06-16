import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = prisma as any
    const cotizacion = await db.cotizacion.findFirst({
      where:  { id: params.id, organizationId: payload.orgId },
      select: {
        id: true, ref: true, recipientName: true, recipientEmail: true,
        total: true, currency: true, status: true, createdAt: true, notes: true,
        items: true,
        empresa: { select: { id: true, name: true } },
        user:    { select: { id: true, name: true } },
      },
    })

    if (!cotizacion) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const org = await prisma.organization.findUnique({
      where:  { id: payload.orgId },
      select: { crmName: true, name: true, primaryColor: true, logoUrl: true, smtpHost: true, smtpUser: true, smtpPass: true },
    })

    return NextResponse.json({
      data: {
        ...cotizacion,
        createdAt:      cotizacion.createdAt.toISOString(),
        orgName:        org?.crmName || org?.name || 'CRM Pro',
        primaryColor:   org?.primaryColor || '#6366f1',
        logoUrl:        org?.logoUrl ?? null,
        agentName:      cotizacion.user?.name || 'El equipo',
        smtpConfigured: !!(org?.smtpHost && org?.smtpUser && org?.smtpPass),
      },
    })
  } catch (error) {
    console.error('[COTIZACION GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { status } = await req.json()
    const allowed = ['GUARDADA', 'ENVIADA', 'ACEPTADA']
    if (!allowed.includes(status)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })

    const db = prisma as any
    const existing = await db.cotizacion.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    await db.cotizacion.update({ where: { id: params.id }, data: { status } })
    return NextResponse.json({ message: 'Estado actualizado' })
  } catch (error) {
    console.error('[COTIZACION PATCH]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
