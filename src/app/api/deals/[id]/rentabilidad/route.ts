import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// GET /api/deals/[id]/rentabilidad — margen real de la obra:
//   ingresos (facturas emitidas, o cotizaciones aceptadas si no hay facturas)
//   − costos reales (entregas ENTREGADAS + compras CONFIRMADAS imputadas)
//   = margen real, comparado con el margen que se cotizó.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role as Role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const deal = await db.deal.findFirst({
      where: { id: params.id, organizationId: payload.orgId, ...(payload.role === 'SELLER' && { ownerId: payload.userId }) },
      select: { id: true, currency: true },
    })
    if (!deal) return NextResponse.json({ error: 'Deal no encontrado' }, { status: 404 })

    const [invoices, cotizaciones, entregas, compras] = await Promise.all([
      db.invoice.findMany({ where: { organizationId: payload.orgId, dealId: params.id }, select: { amount: true, currency: true, status: true, subtotal: true } }),
      db.cotizacion.findMany({ where: { organizationId: payload.orgId, dealId: params.id, status: 'ACEPTADA' }, select: { finalTotal: true, total: true, currency: true, items: true } }),
      db.entregaStock.findMany({ where: { organizationId: payload.orgId, dealId: params.id, estado: 'ENTREGADA' }, select: { items: { select: { cantidad: true, costoUnitario: true } } } }),
      db.compra.findMany({ where: { organizationId: payload.orgId, dealId: params.id, estado: 'CONFIRMADA' }, select: { total: true, moneda: true } }),
    ])

    const sumByCur = (rows: any[], val: (r: any) => number, cur: (r: any) => string) => {
      const acc: Record<string, number> = {}
      for (const r of rows) acc[cur(r)] = (acc[cur(r)] ?? 0) + val(r)
      return acc
    }

    // Ingresos: facturas si hay; si no, cotizaciones aceptadas.
    const ingresos = invoices.length
      ? sumByCur(invoices, (r) => r.amount, (r) => r.currency)
      : sumByCur(cotizaciones, (r) => r.finalTotal || r.total, (r) => r.currency)

    // Costo real de materiales entregados.
    let costoEntregado = 0
    for (const e of entregas) for (const it of e.items) costoEntregado += (it.costoUnitario ?? 0) * it.cantidad
    const costoCompras = sumByCur(compras, (r) => r.total, (r) => r.moneda)

    // Costo cotizado (estimado): Product.costo actual × cantidad de los ítems PRODUCT.
    const productIds = new Set<string>()
    for (const c of cotizaciones) for (const it of (Array.isArray(c.items) ? c.items : [])) {
      if (it?.type === 'PRODUCT' && typeof it.productId === 'string') productIds.add(it.productId)
    }
    const costos = productIds.size
      ? await db.product.findMany({ where: { id: { in: Array.from(productIds) }, organizationId: payload.orgId }, select: { id: true, costo: true } })
      : []
    const costoById = new Map(costos.map((p: any) => [p.id, p.costo ?? 0]))
    let costoCotizado = 0
    for (const c of cotizaciones) for (const it of (Array.isArray(c.items) ? c.items : [])) {
      if (it?.type === 'PRODUCT' && typeof it.productId === 'string') {
        costoCotizado += (Number(costoById.get(it.productId)) || 0) * (Number(it.quantity) || 1)
      }
    }

    return NextResponse.json({
      data: {
        moneda: deal.currency,
        ingresos,                       // por moneda
        facturado: invoices.length > 0,
        costoReal: { materiales: costoEntregado, compras: costoCompras },
        costoCotizado,
      },
    })
  } catch (error) {
    console.error('[DEAL RENTABILIDAD]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
