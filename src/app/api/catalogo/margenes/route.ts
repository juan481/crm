import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Margen por familia de producto para el motor de comisiones
// (reestructuración Abba 2026-10) — endpoint propio, separado de
// /api/catalogo/categories (que ya sirve a cotizador/catálogo público/
// Gremio con otra forma, conteos de productos en vez de margen). Sólo
// ADMIN+ lo necesita: es configuración de precios/comisión, no un filtro.
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    // Plano, ordenado por padre → nombre — la UI lo agrupa en árbol ella
    // misma (mismas ~2 familias de nivel, no vale la pena anidar en la API).
    const categorias = await db.productCategory.findMany({
      where: { organizationId: payload.orgId },
      select: { id: true, name: true, parentId: true, margenPct: true },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ data: categorias })
  } catch (error) {
    console.error('[CATALOGO MARGENES GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { id, margenPct } = await req.json()
    if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Falta la categoría' }, { status: 400 })
    // null = "sin configurar" (no aporta ganancia hasta que se cargue) —
    // mismo criterio que el resto del motor, nunca se inventa un número.
    if (margenPct !== null && (typeof margenPct !== 'number' || !Number.isFinite(margenPct) || margenPct < 0 || margenPct > 100)) {
      return NextResponse.json({ error: 'El margen tiene que ser un número entre 0 y 100 (o vacío)' }, { status: 400 })
    }

    const db = prisma as any
    const categoria = await db.productCategory.findFirst({ where: { id, organizationId: payload.orgId }, select: { id: true } })
    if (!categoria) return NextResponse.json({ error: 'Categoría no encontrada en esta organización' }, { status: 404 })

    const updated = await db.productCategory.update({
      where: { id },
      data: { margenPct },
      select: { id: true, name: true, parentId: true, margenPct: true },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[CATALOGO MARGENES PATCH]', error)
    return NextResponse.json({ error: 'Error al guardar el margen' }, { status: 500 })
  }
}
