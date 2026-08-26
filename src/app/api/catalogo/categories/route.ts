import { NextResponse } from 'next/server'
import { getCurrentUserAny, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Categorías de nivel 1 del catálogo (parentId null), con sus hijos de
// nivel 2 anidados — usadas para el filtro en cascada (categoría →
// subcategoría) de /catalogo, el Cotizador y el portal Gremio. Mismo
// chequeo de rol que GET /api/catalogo/products (SELLER+ o GREMIO
// explícito).
export async function GET() {
  try {
    const payload = await getCurrentUserAny()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (payload.role !== 'GREMIO' && !canAccess(payload.role, 'SELLER')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const roots = await db.productCategory.findMany({
      where: { organizationId: payload.orgId, parentId: null },
      select: { id: true, name: true, children: { select: { id: true, name: true }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    })

    // Los productos cuelgan del nivel 2 (la hoja, ej. "CCTV > CAMARAS IP
    // WIFI"), no del nivel 1 — por eso el conteo por raíz suma también los
    // productos de sus hijos directos, si no siempre daría 0.
    const counts = await db.product.groupBy({
      by: ['categoryId'],
      where: {
        organizationId: payload.orgId,
        active: true,
        // Mismo filtro que GET /api/catalogo/products para GREMIO — sin
        // esto, el número en la pestaña de categoría no coincidía con la
        // cantidad real de productos comprables al entrar (los ~68
        // placeholder sin precio contaban acá pero no aparecían al listar).
        ...(payload.role === 'GREMIO' ? { price: { gt: 0 } } : {}),
        categoryId: { in: roots.flatMap((r: any) => [r.id, ...r.children.map((c: any) => c.id)]) },
      },
      _count: { _all: true },
    })
    const countByCategoryId = new Map<string, number>(counts.map((c: any) => [c.categoryId as string, c._count._all]))

    const data = roots.map((r: any) => {
      const children = r.children.map((c: any) => ({
        id: c.id,
        name: c.name,
        productCount: countByCategoryId.get(c.id) ?? 0,
      }))
      // El total de la raíz incluye lo tageado directamente en ella (poco
      // común, pero posible) más lo de cada hijo.
      const total = (countByCategoryId.get(r.id) ?? 0) + children.reduce((s: number, c: any) => s + c.productCount, 0)
      return { id: r.id, name: r.name, productCount: total, children }
    })

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[CATALOGO CATEGORIES GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
