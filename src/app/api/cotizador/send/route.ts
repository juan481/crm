import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isOrgEmailConfigured } from '@/lib/email'
import type { QuoteItem } from '@/types'

// This endpoint ONLY saves the cotizacion to DB and creates the EmpresaNota.
// Email sending (with PDF attachment) is handled separately by /api/cotizador/enviar-mail.
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN', 'SELLER'].includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json()
    const { items, recipientEmail, recipientName, notes, discount = 0, currency, empresaId, validityDays, dealId } = body as {
      items: QuoteItem[]
      empresaId?: string | null
      dealId?: string | null
      recipientEmail: string
      recipientName: string
      notes?: string
      discount?: number
      currency: string
      validityDays?: number
    }

    if (!items?.length)  return NextResponse.json({ error: 'Sin servicios seleccionados' }, { status: 400 })
    if (!recipientEmail) return NextResponse.json({ error: 'Email destinatario requerido' },  { status: 400 })

    // El total nunca se confía del cliente — se recalcula server-side a
    // partir de los ítems, que sí quedan guardados tal cual en la cotización.
    const total        = items.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0)
    const discountPct  = Math.max(0, Math.min(100, Number(discount) || 0))
    const finalTotal   = total * (1 - discountPct / 100)

    const db = prisma as any

    // Si viene de una oportunidad de Pipeline, validar que exista en esta org
    // (y, para SELLER, que sea suya) antes de vincularla estructuralmente.
    let linkedDealId: string | null = null
    if (dealId) {
      const deal = await db.deal.findFirst({
        where: {
          id: dealId,
          organizationId: payload.orgId,
          ...(payload.role === 'SELLER' && { ownerId: payload.userId }),
        },
        select: { id: true },
      })
      if (deal) linkedDealId = deal.id
    }

    // La empresa debe pertenecer a esta organización — sin esto, un empresaId
    // de OTRA org quedaba vinculado igual (cotización + EmpresaNota cruzando
    // el aislamiento multi-tenant).
    let linkedEmpresaId: string | null = null
    if (empresaId) {
      const empresa = await db.empresa.findFirst({
        where: { id: empresaId, organizationId: payload.orgId },
        select: { id: true },
      })
      if (!empresa) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 400 })
      linkedEmpresaId = empresa.id
    }

    const [org, agent] = await Promise.all([
      prisma.organization.findUnique({
        where:  { id: payload.orgId },
        select: {
          name: true, crmName: true, primaryColor: true, logoUrl: true, quoteValidityDays: true,
          smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
          smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
        },
      }),
      prisma.user.findUnique({
        where:  { id: payload.userId },
        select: { name: true },
      }),
    ])

    const orgName      = org?.name || org?.crmName || 'CRM Pro'
    const primaryColor = org?.primaryColor || '#6366f1'
    const agentName    = agent?.name || 'El equipo'
    // Sufijo random además del timestamp — dos requests en el mismo
    // milisegundo (dos sellers a la vez, o un retry) no deben colisionar.
    const quoteRef     = `PRESUP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    const validityDaysFinal = Math.max(1, Math.min(365, Number(validityDays) || org?.quoteValidityDays || 30))

    // Save cotizacion to DB
    const cotizacion = await db.cotizacion.create({
      data: {
        ref:            quoteRef,
        organizationId: payload.orgId,
        userId:         payload.userId,
        empresaId:      linkedEmpresaId,
        dealId:         linkedDealId,
        recipientEmail,
        recipientName:  recipientName || 'Cliente',
        items:          items as any,
        total,
        discount:       discountPct,
        finalTotal,
        currency,
        notes:          notes || null,
        validityDays:   validityDaysFinal,
        status:         'GUARDADA',
      },
      select: { id: true },
    })

    // Create EmpresaNota if empresa is linked
    if (linkedEmpresaId) {
      const serviceNames = items.map(i => i.name).join(', ')
      const totalStr = new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(total)
      await db.empresaNota.create({
        data: {
          empresaId: linkedEmpresaId,
          organizationId: payload.orgId,
          userId:         payload.userId,
          tipo:           'ENVIO_COTIZACION',
          content:        `Cotización ${quoteRef} generada por ${agentName} para ${recipientName || recipientEmail}. Total: ${totalStr}. Servicios: ${serviceNames}.`,
        },
      })
    }

    return NextResponse.json({
      cotizacionId: cotizacion.id,
      dealId:       linkedDealId,
      ref:          quoteRef,
      orgName,
      primaryColor,
      logoUrl:      org?.logoUrl ?? null,
      agentName,
      discount:     discountPct,
      finalTotal,
      validityDays: validityDaysFinal,
      smtpConfigured: isOrgEmailConfigured(org),
    })
  } catch (error) {
    console.error('[COTIZADOR SAVE]', error)
    return NextResponse.json({ error: 'Error al guardar el presupuesto' }, { status: 500 })
  }
}
