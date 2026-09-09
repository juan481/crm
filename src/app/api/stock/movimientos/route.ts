import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { puedeVerStock } from '@/lib/stock-access'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// GET /api/stock/movimientos — historial inmutable de movimientos de stock.
// Filtros (todos opcionales, combinables):
//   ?productId= ?origen= ?dealId= ?compraId= ?entregaId= ?creadoPorId=
//   ?desde=YYYY-MM-DD ?hasta=YYYY-MM-DD ?search= (nombre de producto / motivo / comprobante)
//   ?page= ?limit=
export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerStock(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const sp = req.nextUrl.searchParams
    const page  = Math.max(1, Number(sp.get('page') ?? 1))
    const limit = Math.min(200, Math.max(1, Number(sp.get('limit') ?? 50)))
    const skip  = (page - 1) * limit

    const db = prisma as any
    const where: Record<string, unknown> = { organizationId: payload.orgId }

    const eq = (k: string, v: string | null) => { if (v) where[k] = v }
    eq('productId',   sp.get('productId'))
    eq('origen',      sp.get('origen'))
    eq('dealId',      sp.get('dealId'))
    eq('compraId',    sp.get('compraId'))
    eq('entregaId',   sp.get('entregaId'))
    eq('creadoPorId', sp.get('creadoPorId'))

    const desde = sp.get('desde')
    const hasta = sp.get('hasta')
    if (desde || hasta) {
      const range: Record<string, Date> = {}
      if (desde && !isNaN(Date.parse(desde))) range.gte = new Date(desde + 'T00:00:00')
      if (hasta && !isNaN(Date.parse(hasta))) range.lte = new Date(hasta + 'T23:59:59.999')
      if (Object.keys(range).length) where.createdAt = range
    }

    const search = (sp.get('search') ?? '').trim()
    if (search.length >= 2) {
      where.OR = [
        { motivo:            { contains: search, mode: 'insensitive' } },
        { numeroComprobante: { contains: search, mode: 'insensitive' } },
        { product:           { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [rows, total] = await Promise.all([
      db.stockMovimiento.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, tipo: true, cantidad: true, stockResultante: true,
          motivo: true, origen: true, numeroComprobante: true, costoUnitario: true,
          createdAt: true, creadoPorId: true,
          compraId: true, entregaId: true, dealId: true,
          product: { select: { id: true, name: true, sku: true, unit: true } },
        },
      }),
      db.stockMovimiento.count({ where }),
    ])

    // Nombre de quien cargó cada movimiento — un lookup por lote.
    const userIds = Array.from(new Set(rows.map((r: any) => r.creadoPorId).filter(Boolean))) as string[]
    const users = userIds.length
      ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : []
    const nombrePorUser = new Map<string, string>(users.map((u: any) => [u.id, u.name]))

    const data = rows.map((r: any) => ({
      id: r.id,
      tipo: r.tipo,
      cantidad: r.cantidad,
      stockResultante: r.stockResultante,
      motivo: r.motivo,
      origen: r.origen,
      numeroComprobante: r.numeroComprobante,
      costoUnitario: r.costoUnitario,
      createdAt: r.createdAt.toISOString(),
      creadoPor: r.creadoPorId ? (nombrePorUser.get(r.creadoPorId) ?? null) : null,
      compraId: r.compraId,
      entregaId: r.entregaId,
      dealId: r.dealId,
      product: r.product,
    }))

    return NextResponse.json({
      data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)),
    })
  } catch (error) {
    console.error('[STOCK MOVIMIENTOS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
