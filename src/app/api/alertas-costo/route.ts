import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { puedeVerStock } from '@/lib/stock-access'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// GET /api/alertas-costo — alertas de cambio de costo.
//   ?estado=PENDIENTE|APLICADA|DESCARTADA (default PENDIENTE) ?origen=COMPRA|SYNC ?page= ?limit=
export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerStock(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const sp = req.nextUrl.searchParams
    const estado = sp.get('estado') ?? 'PENDIENTE'
    const origen = sp.get('origen')
    const page   = Math.max(1, Number(sp.get('page') ?? 1))
    const limit  = Math.min(100, Math.max(1, Number(sp.get('limit') ?? 50)))
    const skip   = (page - 1) * limit

    const db = prisma as any
    const where: Record<string, unknown> = { organizationId: payload.orgId }
    if (estado && estado !== 'TODAS') where.estado = estado
    if (origen) where.origen = origen

    const [rows, total, pendientes] = await Promise.all([
      db.alertaCosto.findMany({
        where, orderBy: { createdAt: 'desc' }, skip, take: limit,
        select: {
          id: true, costoAnterior: true, costoNuevo: true, precioAnterior: true, precioNuevo: true,
          variacionPct: true, origen: true, compraId: true, estado: true, createdAt: true,
          product: { select: { id: true, name: true, sku: true, currency: true } },
        },
      }),
      db.alertaCosto.count({ where }),
      db.alertaCosto.count({ where: { organizationId: payload.orgId, estado: 'PENDIENTE' } }),
    ])

    const data = rows.map((a: any) => ({ ...a, createdAt: a.createdAt.toISOString() }))
    return NextResponse.json({ data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), pendientes })
  } catch (error) {
    console.error('[ALERTAS-COSTO GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
