import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Duplicar una cotización — pedido de Abba: rehacer una cotización larga
// desde cero (por ej. para mandarla en la otra moneda) pierde tiempo. Crea
// una copia nueva (GUARDADA, sin enviar) con los mismos ítems/destinatario;
// después se puede ajustar (ver .../cambiar-moneda) y mandar aparte —
// nunca pisa ni reemplaza la original.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER') && !(await roleHasModule(payload.orgId, payload.role, 'cotizaciones')))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const original = await db.cotizacion.findFirst({
      where: {
        id: params.id, organizationId: payload.orgId,
        ...(payload.role === 'SELLER' && { userId: payload.userId }),
      },
    })
    if (!original) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const ref = `PRESUP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

    const copia = await db.cotizacion.create({
      data: {
        ref,
        organizationId: payload.orgId,
        userId: payload.userId,
        empresaId: original.empresaId,
        dealId: original.dealId,
        recipientEmail: original.recipientEmail,
        recipientName: original.recipientName,
        items: original.items,
        total: original.total,
        discount: original.discount,
        finalTotal: original.finalTotal,
        currency: original.currency,
        notes: original.notes,
        validityDays: original.validityDays,
        status: 'GUARDADA',
        priceMode: original.priceMode,
        ivaDiscriminado: original.ivaDiscriminado,
      },
      select: { id: true, ref: true },
    })

    return NextResponse.json({ data: copia }, { status: 201 })
  } catch (error) {
    console.error('[COTIZACION DUPLICAR]', error)
    return NextResponse.json({ error: 'Error al duplicar' }, { status: 500 })
  }
}
