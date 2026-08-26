import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Browsing paginado del catálogo (sku != null) — a diferencia de
// GET /api/products (que trae todo sin paginar, pensado para la puñado de
// productos "simples"), este endpoint es el que consumen /catalogo, el
// selector de productos del Cotizador y el portal Gremio, todos con
// potencialmente miles de SKUs.
//
// Accesible a SELLER+ Y a GREMIO explícitamente — GREMIO es un carril
// lateral (portal propio), no participa de la jerarquía interna de
// canAccess(), así que se chequea el rol literal además de la jerarquía
// (mismo criterio en cualquier endpoint que consuma el portal).
export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (payload.role !== 'GREMIO' && !canAccess(payload.role, 'SELLER')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = req.nextUrl
    const q          = searchParams.get('q')?.trim() ?? ''
    const categoryId = searchParams.get('categoryId')
    const brand      = searchParams.get('brand')
    const page       = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit      = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 24)))
    const skip       = (page - 1) * limit

    const db = prisma as any
    const where: Record<string, unknown> = {
      organizationId: payload.orgId,
      sku: { not: null },
      active: true,
    }
    if (categoryId) where.categoryId = categoryId
    if (brand) where.brand = brand
    if (q.length >= 2) {
      where.OR = [
        { name:  { contains: q, mode: 'insensitive' } },
        { sku:   { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { mpn:   { contains: q, mode: 'insensitive' } },
      ]
    }

    const [data, total] = await Promise.all([
      db.product.findMany({
        where, skip, take: limit,
        orderBy: { name: 'asc' },
        include: { category: { select: { id: true, name: true, parentId: true } } },
      }),
      db.product.count({ where }),
    ])

    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[CATALOGO PRODUCTS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
