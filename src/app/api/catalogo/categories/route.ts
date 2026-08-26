import { NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Categorías de nivel 1 del catálogo (parentId null) — usadas como tabs de
// filtro en /catalogo y en el portal Gremio. Mismo chequeo de rol que
// GET /api/catalogo/products (SELLER+ o GREMIO explícito).
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    // Cast: GREMIO se suma al union type Role recién en el Módulo 3 (rol +
    // portal B2B) — este chequeo ya queda listo para ese momento.
    if ((payload.role as string) !== 'GREMIO' && !canAccess(payload.role, 'SELLER')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const roots = await db.productCategory.findMany({
      where: { organizationId: payload.orgId, parentId: null },
      select: { id: true, name: true, children: { select: { id: true } } },
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
        categoryId: { in: roots.flatMap((r: any) => [r.id, ...r.children.map((c: any) => c.id)]) },
      },
      _count: { _all: true },
    })
    const countByCategoryId = new Map<string, number>(counts.map((c: any) => [c.categoryId as string, c._count._all]))

    const data = roots.map((r: any) => {
      let total = countByCategoryId.get(r.id) ?? 0
      for (const c of r.children) total += countByCategoryId.get(c.id) ?? 0
      return { id: r.id, name: r.name, productCount: total }
    })

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[CATALOGO CATEGORIES GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
