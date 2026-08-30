import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserAny, canAccess } from '@/lib/auth'
import { searchCatalogo } from '@/lib/catalogo-search'

export const dynamic = 'force-dynamic'

// Browsing paginado del catálogo (sku != null) — a diferencia de
// GET /api/products (que trae todo sin paginar, pensado para la puñado de
// productos "simples"), este endpoint es el que consumen /catalogo, el
// selector de productos del Cotizador y el portal Gremio, todos con
// potencialmente miles de SKUs. La lógica de filtros vive en
// src/lib/catalogo-search.ts (searchCatalogo), compartida con la herramienta
// buscar_catalogo de NISSI.
//
// Accesible a SELLER+ Y a GREMIO explícitamente — GREMIO es un carril
// lateral (portal propio), no participa de la jerarquía interna de
// canAccess(), así que se chequea el rol literal además de la jerarquía.
export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUserAny()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (payload.role !== 'GREMIO' && !canAccess(payload.role, 'SELLER')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = req.nextUrl
    const q = searchParams.get('q')?.trim() ?? ''
    const categoryId = searchParams.get('categoryId')
    const brand = searchParams.get('brand')
    // 'active' (default) | 'inactive' | 'all' — sólo para SELLER+ administrando
    // el catálogo. GREMIO nunca puede pedir otra cosa que 'active'.
    const statusParam = payload.role !== 'GREMIO'
      ? ((searchParams.get('status') ?? 'active') as 'active' | 'inactive' | 'all')
      : 'active'
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 24)))
    // El selector inline del Cotizador no usa total/totalPages — pedirlo igual
    // duplica el viaje al pooler de Supabase.
    const withCount = searchParams.get('withCount') !== '0'

    const result = await searchCatalogo(payload.orgId, {
      q,
      categoria: categoryId,
      brand,
      status: statusParam,
      gremio: payload.role === 'GREMIO',
      page,
      limit,
      withCount,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[CATALOGO PRODUCTS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
