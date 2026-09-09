import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// GET /api/deals/[id]/materiales — todo lo de depósito imputado a esta obra:
// entregas de stock + compras vinculadas, con el costo real acumulado.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role as Role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const deal = await db.deal.findFirst({
      where: { id: params.id, organizationId: payload.orgId, ...(payload.role === 'SELLER' && { ownerId: payload.userId }) },
      select: { id: true },
    })
    if (!deal) return NextResponse.json({ error: 'Deal no encontrado' }, { status: 404 })

    const [entregas, compras] = await Promise.all([
      db.entregaStock.findMany({
        where: { organizationId: payload.orgId, dealId: params.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, numero: true, estado: true, fecha: true, retiradoPor: true, motivo: true,
          items: { select: { nombre: true, cantidad: true, costoUnitario: true } },
        },
      }),
      db.compra.findMany({
        where: { organizationId: payload.orgId, dealId: params.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, numero: true, estado: true, fecha: true, moneda: true, total: true,
          numeroComprobante: true, proveedor: { select: { name: true } },
        },
      }),
    ])

    // Costo real de materiales entregados (sólo entregas ENTREGADAS).
    let costoEntregado = 0
    for (const e of entregas) {
      if (e.estado !== 'ENTREGADA') continue
      for (const it of e.items) costoEntregado += (it.costoUnitario ?? 0) * it.cantidad
    }
    // Compras confirmadas imputadas a la obra (pueden estar en otra moneda).
    const comprasPorMoneda: Record<string, number> = {}
    for (const c of compras) {
      if (c.estado !== 'CONFIRMADA') continue
      comprasPorMoneda[c.moneda] = (comprasPorMoneda[c.moneda] ?? 0) + c.total
    }

    return NextResponse.json({
      data: {
        entregas: entregas.map((e: any) => ({
          ...e,
          fecha: e.fecha.toISOString(),
          unidades: e.items.reduce((s: number, i: any) => s + i.cantidad, 0),
          costo: e.items.reduce((s: number, i: any) => s + (i.costoUnitario ?? 0) * i.cantidad, 0),
        })),
        compras: compras.map((c: any) => ({ ...c, fecha: c.fecha.toISOString() })),
        resumen: { costoEntregado, comprasPorMoneda },
      },
    })
  } catch (error) {
    console.error('[DEAL MATERIALES]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
