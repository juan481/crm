import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isOrgEmailConfigured } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const cotizacion = await db.cotizacion.findFirst({
      where:  { id: params.id, organizationId: payload.orgId },
      select: {
        id: true, ref: true, recipientName: true, recipientEmail: true,
        total: true, discount: true, finalTotal: true, currency: true, status: true, createdAt: true, notes: true,
        validityDays: true,
        items: true,
        empresa: { select: { id: true, name: true } },
        user:    { select: { id: true, name: true } },
      },
    })

    if (!cotizacion) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const org = await prisma.organization.findUnique({
      where:  { id: payload.orgId },
      select: {
        crmName: true, name: true, primaryColor: true, logoUrl: true,
        smtpHost: true, smtpUser: true, smtpPass: true,
        smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
      },
    })

    return NextResponse.json({
      data: {
        ...cotizacion,
        createdAt:      cotizacion.createdAt.toISOString(),
        validityDays:   cotizacion.validityDays ?? 30,
        // The client-facing brand name (org.name) must win over crmName, which is just the
        // CRM product's own internal label — showing crmName here leaked "JustCRM" onto quotes.
        orgName:        org?.name || org?.crmName || 'CRM Pro',
        primaryColor:   org?.primaryColor || '#6366f1',
        logoUrl:        org?.logoUrl ?? null,
        agentName:      cotizacion.user?.name || 'El equipo',
        smtpConfigured: isOrgEmailConfigured(org),
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
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { status, dealId } = await req.json()
    const allowed = ['GUARDADA', 'ENVIADA', 'ACEPTADA', 'RECHAZADA', 'VENCIDA']
    if (status !== undefined && !allowed.includes(status)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })

    const db = prisma as any
    const existing = await db.cotizacion.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    // Vincular a un deal existente (ej. al agregar una cotización ad-hoc al
    // Pipeline) — valida que el deal sea de esta org (y, para SELLER, suyo).
    let resolvedDealId: string | null | undefined = undefined
    if (dealId !== undefined) {
      if (dealId === null) {
        resolvedDealId = null
      } else {
        const deal = await db.deal.findFirst({
          where: {
            id: dealId,
            organizationId: payload.orgId,
            ...(payload.role === 'SELLER' && { ownerId: payload.userId }),
          },
          select: { id: true },
        })
        if (!deal) return NextResponse.json({ error: 'Deal no encontrado' }, { status: 400 })
        resolvedDealId = deal.id
      }
    }

    await db.cotizacion.update({
      where: { id: params.id },
      data: {
        ...(status !== undefined && { status }),
        ...(resolvedDealId !== undefined && { dealId: resolvedDealId }),
      },
    })
    return NextResponse.json({ message: 'Cotización actualizada' })
  } catch (error) {
    console.error('[COTIZACION PATCH]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
