import { NextResponse } from 'next/server'
import { getCurrentUserAny, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Marcas distintas del catálogo (77 valores reales) — demasiadas para chips,
// se usan en un <select>. Mismo chequeo de rol y mismos filtros de
// visibilidad que GET /api/catalogo/products (SELLER+ o GREMIO explícito;
// GREMIO no ve marcas cuyos únicos productos sean placeholders a precio 0).
export async function GET() {
  try {
    const payload = await getCurrentUserAny()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (payload.role !== 'GREMIO' && !canAccess(payload.role, 'SELLER')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const counts = await db.product.groupBy({
      by: ['brand'],
      where: {
        organizationId: payload.orgId,
        sku: { not: null },
        active: true,
        brand: { not: null },
        ...(payload.role === 'GREMIO' ? { price: { gt: 0 } } : {}),
      },
      _count: { _all: true },
    })

    const data = counts
      .filter((c: any) => c.brand)
      .map((c: any) => ({ value: c.brand as string, count: c._count._all as number }))
      .sort((a: any, b: any) => a.value.localeCompare(b.value))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[CATALOGO BRANDS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
