import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserAny, canAccess } from '@/lib/auth'
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
    const payload = await getCurrentUserAny()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (payload.role !== 'GREMIO' && !canAccess(payload.role, 'SELLER')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = req.nextUrl
    const q          = searchParams.get('q')?.trim() ?? ''
    const categoryId = searchParams.get('categoryId')
    const brand      = searchParams.get('brand')
    // 'active' (default, todo consumidor normal) | 'inactive' | 'all' — sólo
    // tiene sentido para SELLER+ administrando el catálogo (dar de baja un
    // SKU sin borrarlo, ver qué está desactivado). GREMIO nunca puede pedir
    // otra cosa que no sea 'active': ver un producto dado de baja en el
    // portal sería mostrar algo que un ADMIN decidió ocultar a propósito.
    const statusParam = payload.role !== 'GREMIO' ? (searchParams.get('status') ?? 'active') : 'active'
    const page       = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit      = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 24)))
    const skip       = (page - 1) * limit
    // El selector inline del Cotizador (y cualquier otro consumidor que
    // sólo necesite una lista corta, sin paginar) no usa `total`/
    // `totalPages` para nada — pedirlo igual duplica el viaje de ida y
    // vuelta al pooler remoto de Supabase (encontrado en auditoría: ~3.5s
    // en vez de ~1.7s en esta búsqueda, con la latencia de red ya
    // documentada en src/lib/auth.ts). `/catalogo`, el portal Gremio y el
    // panel de admin SÍ paginan y siguen pidiendo el conteo por default.
    const withCount = searchParams.get('withCount') !== '0'

    const db = prisma as any
    const where: Record<string, unknown> = {
      organizationId: payload.orgId,
      sku: { not: null },
      ...(statusParam === 'all' ? {} : { active: statusParam === 'inactive' ? false : true }),
    }
    // ~68 productos del catálogo del proveedor son "placeholder" sin
    // cotizar todavía (costo=precioGremio=precioPublico=0) — se importan
    // igual para que Abba los complete, pero el portal Gremio no debe
    // ofrecerlos como comprables (un precio $0 real terminaría en un
    // pedido gratis). El browsing interno (/catalogo, admin, Cotizador) sí
    // los sigue mostrando — un vendedor los ve venir con precio 0 antes de
    // decidir agregarlos, mismo criterio que ya usa POST /api/gremio/pedidos
    // como barrera autoritativa del lado del servidor.
    if (payload.role === 'GREMIO') where.price = { gt: 0 }
    if (categoryId) {
      // Los productos cuelgan del nivel 2 (la hoja, ej. "CCTV > CAMARAS IP
      // WIFI"), nunca del nivel 1 — filtrar por categoryId = id de la raíz
      // directamente daba SIEMPRE 0 resultados (bug real, encontrado
      // probando el filtro con un browser real: el badge decía "ALARMAS
      // (315)" pero al hacer clic mostraba "sin resultados"). Si el id que
      // llega es una raíz, se resuelve a [ella misma, ...sus hijos] —
      // mismo criterio que ya usa el conteo de /api/catalogo/categories.
      const asParent = await db.productCategory.findMany({
        where: { parentId: categoryId },
        select: { id: true },
      })
      where.categoryId = asParent.length > 0
        ? { in: [categoryId, ...asParent.map((c: any) => c.id)] }
        : categoryId
    }
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
      // Sin count real cuando no hace falta paginar — total/totalPages
      // quedan como una aproximación basada en lo que ya se trajo (el
      // caller que pide withCount=0 nunca los usa para renderizar
      // paginación, así que no hay riesgo de mostrar un número raro).
      withCount ? db.product.count({ where }) : Promise.resolve(null),
    ])

    const totalCount = total ?? (skip + data.length)
    return NextResponse.json({ data, total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) })
  } catch (error) {
    console.error('[CATALOGO PRODUCTS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
