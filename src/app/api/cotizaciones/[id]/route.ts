import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import { prisma } from '@/lib/db'
import { isOrgEmailConfigured } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER') && !(await roleHasModule(payload.orgId, payload.role, 'cotizaciones'))) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const cotizacion = await db.cotizacion.findFirst({
      where:  {
        id: params.id,
        organizationId: payload.orgId,
        ...(payload.role === 'SELLER' && { userId: payload.userId }),
      },
      select: {
        id: true, ref: true, recipientName: true, recipientEmail: true,
        total: true, discount: true, finalTotal: true, currency: true, status: true, createdAt: true, notes: true,
        validityDays: true, ivaDiscriminado: true, priceMode: true,
        entregaGenerada: true, dealId: true,
        items: true,
        empresa: { select: { id: true, name: true, isCliente: true } },
        user:    { select: { id: true, name: true } },
      },
    })

    if (!cotizacion) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    // ¿Ya se emitió una factura de esta cotización? (Fase 4)
    const factura = await (prisma as any).invoice.findFirst({
      where: { organizationId: payload.orgId, cotizacionId: cotizacion.id },
      select: { id: true, numeroInterno: true },
    })

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
        facturaEmitida: factura ? { id: factura.id, numeroInterno: factura.numeroInterno } : null,
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
    if (!canAccess(payload.role, 'SELLER') && !(await roleHasModule(payload.orgId, payload.role, 'cotizaciones'))) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { status, dealId, sellerId } = await req.json()
    const allowed = ['GUARDADA', 'ENVIADA', 'ACEPTADA', 'RECHAZADA', 'VENCIDA']
    if (status !== undefined && !allowed.includes(status)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })

    const db = prisma as any
    const existing = await db.cotizacion.findFirst({
      where: {
        id: params.id,
        organizationId: payload.orgId,
        ...(payload.role === 'SELLER' && { userId: payload.userId }),
      },
      select: { id: true, dealId: true },
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    // "¿Quién vendió esto?" — mismo criterio que Pipeline y el Cotizador
    // (pedido de Abba, Seba 2026-10-02): marcar una cotización ya cargada
    // como Aceptada es, conceptualmente, lo mismo que ganar un deal — tiene
    // que poder reasignarse al vendedor real en el mismo paso, no aparte.
    // Sólo Admin+ puede tocar esto (mismo piso que /api/deals). Si la
    // cotización tiene un deal vinculado, se reasigna también para no
    // desincronizar cartera entre los dos registros.
    let resolvedSellerId: string | undefined
    if (sellerId) {
      if (!canAccess(payload.role, 'ADMIN')) {
        return NextResponse.json({ error: 'Sólo un admin puede reasignar a otro vendedor' }, { status: 403 })
      }
      const seller = await db.user.findFirst({ where: { id: sellerId, organizationId: payload.orgId }, select: { id: true } })
      if (!seller) return NextResponse.json({ error: 'Vendedor no encontrado en esta organización' }, { status: 400 })
      resolvedSellerId = seller.id
    }

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
        ...(resolvedSellerId && { userId: resolvedSellerId }),
      },
    })

    // Deal vinculado (el que ya tenía, o el que se acaba de vincular en
    // este mismo PATCH) — se reasigna junto, no queda la cotización a
    // nombre de Leonel y la oportunidad de Pipeline a nombre de Seba.
    const dealToSync = resolvedDealId !== undefined ? resolvedDealId : existing.dealId
    if (resolvedSellerId && dealToSync) {
      await db.deal.updateMany({
        where: { id: dealToSync, organizationId: payload.orgId },
        data: { ownerId: resolvedSellerId },
      })
    }

    return NextResponse.json({ message: 'Cotización actualizada' })
  } catch (error) {
    console.error('[COTIZACION PATCH]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Borrar cotizaciones — pedido de Abba: sólo Super Admin, para limpiar
// rechazadas/guardadas viejas que ya no sirven. Ni ADMIN ni SELLER pueden
// (a diferencia del resto de este archivo, que sí acepta ADMIN/SELLER vía
// roleHasModule) — es intencionalmente más restrictivo que el resto del
// módulo Cotizaciones.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (payload.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Sólo un Super Admin puede borrar cotizaciones' }, { status: 403 })

    const db = prisma as any
    const existing = await db.cotizacion.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    // No se borra si ya generó una factura real — ahí no es "un guardado al
    // pedo", es un comprobante con historia. Primero desvincular a mano.
    const factura = await db.invoice.findFirst({ where: { organizationId: payload.orgId, cotizacionId: params.id }, select: { id: true } })
    if (factura) return NextResponse.json({ error: 'Esta cotización ya tiene una factura emitida — no se puede borrar.' }, { status: 409 })

    await db.cotizacion.delete({ where: { id: params.id } })
    return NextResponse.json({ message: 'Cotización borrada' })
  } catch (error) {
    console.error('[COTIZACION DELETE]', error)
    return NextResponse.json({ error: 'Error al borrar' }, { status: 500 })
  }
}
