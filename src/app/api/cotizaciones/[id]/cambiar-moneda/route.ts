import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import { prisma } from '@/lib/db'
import { computeQuoteTotals } from '@/lib/quote-totals'
import { getOfficialUsdRate } from '@/lib/exchange-rate'

export const dynamic = 'force-dynamic'

// Convierte TODOS los ítems de una cotización de USD→ARS o de ARS→USD al
// tipo de cambio del día (mismo que ve el vendedor en el cotizador) —
// pedido de Abba: mandar la misma cotización en la otra moneda sin tener
// que rehacerla ítem por ítem. Pensado para usarse sobre una cotización
// recién duplicada (.../duplicar), nunca fuerza a duplicar por su cuenta —
// así el vendedor decide si convierte la original o una copia.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER') && !(await roleHasModule(payload.orgId, payload.role, 'cotizaciones')))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const to = body.to === 'ARS' || body.to === 'USD' ? body.to : null
    if (!to) return NextResponse.json({ error: 'Falta la moneda destino (ARS o USD)' }, { status: 400 })

    const db = prisma as any
    const cot = await db.cotizacion.findFirst({
      where: {
        id: params.id, organizationId: payload.orgId,
        ...(payload.role === 'SELLER' && { userId: payload.userId }),
      },
    })
    if (!cot) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    if (cot.currency === to) return NextResponse.json({ error: `Ya está en ${to}` }, { status: 400 })
    // Sólo se soporta ARS<->USD — otras monedas (si algún día se cargan)
    // quedan afuera a propósito, no hay tipo de cambio confiable para
    // convertirlas acá.
    if (!['ARS', 'USD'].includes(cot.currency)) {
      return NextResponse.json({ error: `No se puede convertir desde ${cot.currency}` }, { status: 400 })
    }

    let rate: number
    try {
      rate = (await getOfficialUsdRate()).venta
    } catch {
      return NextResponse.json({ error: 'No se pudo obtener el tipo de cambio del día — intentá de nuevo en un rato.' }, { status: 503 })
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json({ error: 'Tipo de cambio inválido' }, { status: 503 })
    }

    // ARS -> USD: dividir. USD -> ARS: multiplicar.
    const factor = to === 'ARS' ? rate : 1 / rate
    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

    const items = (Array.isArray(cot.items) ? cot.items : []).map((it: any) => ({
      ...it,
      price: round2(Number(it.price || 0) * factor),
      currency: to,
    }))

    const totals = computeQuoteTotals(
      items.map((it: any) => ({ price: it.price, quantity: it.quantity, ivaPct: it.ivaPct, type: it.type })),
      cot.discount,
      cot.ivaDiscriminado,
    )

    const updated = await db.cotizacion.update({
      where: { id: cot.id },
      data: {
        items, currency: to,
        total: totals.neto,
        finalTotal: totals.total,
      },
      select: { id: true, currency: true, finalTotal: true },
    })

    return NextResponse.json({ data: { ...updated, rateUsed: rate } })
  } catch (error) {
    console.error('[COTIZACION CAMBIAR-MONEDA]', error)
    return NextResponse.json({ error: 'Error al convertir la moneda' }, { status: 500 })
  }
}
