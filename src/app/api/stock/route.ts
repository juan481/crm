import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { puedeVerStock } from '@/lib/stock-access'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// GET /api/stock — resumen del stock físico propio.
//   ?search=       nombre / sku / marca (>= 2 chars)
//   ?filtro=       'bajo-minimo' | 'sin-stock' | 'sin-movimiento-30|60|90'
//   ?categoryId=   id de categoría exacta
//   ?page= ?limit=
export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerStock(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const sp = req.nextUrl.searchParams
    const search     = (sp.get('search') ?? '').trim()
    const filtro     = sp.get('filtro') ?? ''
    const categoryId = sp.get('categoryId') ?? ''
    const page       = Math.max(1, Number(sp.get('page') ?? 1))
    const limit      = Math.min(200, Math.max(1, Number(sp.get('limit') ?? 50)))
    const skip       = (page - 1) * limit

    const db = prisma as any
    const baseWhere = { organizationId: payload.orgId, trackStock: true }
    const where: Record<string, unknown> = { ...baseWhere }

    if (categoryId) where.categoryId = categoryId
    if (search.length >= 2) {
      where.OR = [
        { name:  { contains: search, mode: 'insensitive' } },
        { sku:   { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { mpn:   { contains: search, mode: 'insensitive' } },
      ]
    }
    if (filtro === 'sin-stock') where.stock = { lte: 0 }

    const rows = await db.product.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, sku: true, brand: true, unit: true,
        stock: true, stockReservado: true, stockMinimo: true,
        supplierStock: true, supplierAvailability: true, costo: true, currency: true,
        category: { select: { id: true, name: true } },
      },
    })

    // Último movimiento por producto — un solo groupBy en vez de N queries.
    const ids = rows.map((r: any) => r.id)
    const ultimos = ids.length
      ? await db.stockMovimiento.groupBy({
          by: ['productId'],
          where: { organizationId: payload.orgId, productId: { in: ids } },
          _max: { createdAt: true },
        })
      : []
    const ultimoPorProducto = new Map<string, string | null>(
      ultimos.map((u: any) => [u.productId, u._max.createdAt ? u._max.createdAt.toISOString() : null]),
    )

    const now = Date.now()
    const diasSin = (iso: string | null) =>
      iso ? Math.floor((now - new Date(iso).getTime()) / 86_400_000) : null

    let data = rows.map((r: any) => {
      const ultimoMovimiento = ultimoPorProducto.get(r.id) ?? null
      return {
        id: r.id,
        name: r.name,
        sku: r.sku,
        brand: r.brand,
        unit: r.unit,
        stock: r.stock,
        stockReservado: r.stockReservado,
        disponible: r.stock - r.stockReservado,
        stockMinimo: r.stockMinimo,
        bajoMinimo: r.stockMinimo != null && r.stock <= r.stockMinimo,
        supplierStock: r.supplierStock,
        supplierAvailability: r.supplierAvailability,
        costo: r.costo,
        currency: r.currency,
        categoria: r.category ? { id: r.category.id, name: r.category.name } : null,
        ultimoMovimiento,
        diasSinMovimiento: diasSin(ultimoMovimiento),
      }
    })

    if (filtro === 'bajo-minimo') data = data.filter((d: any) => d.bajoMinimo)
    const sinMov = /^sin-movimiento-(30|60|90)$/.exec(filtro)
    if (sinMov) {
      const umbral = Number(sinMov[1])
      data = data.filter((d: any) => d.diasSinMovimiento == null || d.diasSinMovimiento >= umbral)
    }

    const total = data.length
    const pageData = data.slice(skip, skip + limit)

    // Tarjetas del encabezado — SIEMPRE sobre el universo completo de
    // productos trackeados, sin importar los filtros de la tabla.
    const [universo, alertasPendientes] = await Promise.all([
      db.product.findMany({
        where: baseWhere,
        select: { stock: true, stockMinimo: true, costo: true, currency: true },
      }),
      db.alertaCosto.count({ where: { organizationId: payload.orgId, estado: 'PENDIENTE' } }),
    ])
    const bajoMinimo = universo.filter((r: any) => r.stockMinimo != null && r.stock <= r.stockMinimo).length
    const sinStock   = universo.filter((r: any) => r.stock <= 0).length
    const valorInventario: Record<string, number> = {}
    for (const r of universo) {
      if (r.costo && r.stock > 0) {
        valorInventario[r.currency] = (valorInventario[r.currency] ?? 0) + r.costo * r.stock
      }
    }

    return NextResponse.json({
      data: pageData,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      resumen: {
        productosTrackeados: universo.length,
        bajoMinimo,
        sinStock,
        valorInventario,
        alertasPendientes,
      },
    })
  } catch (error) {
    console.error('[STOCK RESUMEN GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
