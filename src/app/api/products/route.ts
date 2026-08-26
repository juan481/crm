import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Product.currency es String libre en el schema (sin enum/check en la DB).
// Intl.NumberFormat tira un RangeError síncrono ante cualquier código no
// ISO-4217 — un producto con una moneda corrupta rompía con un error
// genérico cualquier pantalla que después intentara mostrar su precio
// (Cotizador, este mismo catálogo, cotizaciones ya guardadas). El único
// punto de entrada sin whitelist era la importación CSV (el alta manual ya
// estaba acotada a un <select> fijo en el frontend) — se valida acá,
// server-side, para blindar también contra un POST directo.
const VALID_CURRENCIES = new Set(['USD', 'ARS', 'EUR'])

export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // scope=simple|catalog|all (default 'all', no rompe ningún caller
    // existente que no mande el parámetro). Necesario desde que el catálogo
    // del proveedor puede tener miles de SKUs — sin filtrar, cualquier
    // pantalla que hoy trae "todos los productos" sin paginar (como el
    // selector simple del cotizador) queda inundada. Ver
    // GET /api/catalogo/products para el browsing paginado del catálogo.
    const scope = req.nextUrl.searchParams.get('scope') ?? 'all'
    const scopeWhere =
      scope === 'simple' ? { sku: null } :
      scope === 'catalog' ? { sku: { not: null } } :
      {}

    const db = prisma as any
    const products = await db.product.findMany({
      where:   { organizationId: payload.orgId, ...scopeWhere },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: products })
  } catch (error) {
    console.error('[PRODUCTS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { name, description, price, currency, unit, trackStock } = await req.json()
    if (!name || price === undefined) {
      return NextResponse.json({ error: 'Nombre y precio son requeridos' }, { status: 400 })
    }
    if (currency !== undefined && !VALID_CURRENCIES.has(currency)) {
      return NextResponse.json({ error: `Moneda inválida: "${currency}". Usá USD, ARS o EUR.` }, { status: 400 })
    }

    const db = prisma as any
    const product = await db.product.create({
      data: {
        name,
        description: description || null,
        price:       Number(price),
        currency:    currency || 'USD',
        unit:        unit || 'unidad',
        trackStock:  !!trackStock,
        organizationId: payload.orgId,
      },
    })

    return NextResponse.json({ data: product }, { status: 201 })
  } catch (error) {
    console.error('[PRODUCTS POST]', error)
    return NextResponse.json({ error: 'Error al crear producto' }, { status: 500 })
  }
}
