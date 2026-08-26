import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

// Mismo motivo que en route.ts (POST) — ver comentario ahí.
const VALID_CURRENCIES = new Set(['USD', 'ARS', 'EUR'])

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const existing = await db.product.findFirst({ where: { id: params.id, organizationId: payload.orgId } })
    if (!existing) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

    const {
      name, description, price, currency, unit, trackStock,
      // Campos de catálogo (Módulo 1) — todos opcionales, el alta manual
      // simple nunca los manda. Para "borrar" un producto de catálogo se
      // prefiere active:false a DELETE, porque el sync de Sheets puede
      // resucitar el SKU si reaparece en la fuente.
      brand, mpn, categoryId, imageUrl, costo, ivaPct, precioGremio,
      supplier, supplierAvailability, active,
    } = await req.json()
    if (currency !== undefined && !VALID_CURRENCIES.has(currency)) {
      return NextResponse.json({ error: `Moneda inválida: "${currency}". Usá USD, ARS o EUR.` }, { status: 400 })
    }
    const product = await db.product.update({
      where: { id: params.id },
      data: {
        ...(name        !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(price       !== undefined && { price: Number(price) }),
        ...(currency    !== undefined && { currency }),
        ...(unit        !== undefined && { unit: unit || 'unidad' }),
        ...(trackStock  !== undefined && { trackStock: !!trackStock }),
        ...(brand                !== undefined && { brand: brand || null }),
        ...(mpn                  !== undefined && { mpn: mpn || null }),
        ...(categoryId           !== undefined && { categoryId: categoryId || null }),
        ...(imageUrl              !== undefined && { imageUrl: imageUrl || null }),
        ...(costo                !== undefined && { costo: costo === null ? null : Number(costo) }),
        ...(ivaPct                !== undefined && { ivaPct: ivaPct === null ? null : Number(ivaPct) }),
        ...(precioGremio          !== undefined && { precioGremio: precioGremio === null ? null : Number(precioGremio) }),
        ...(supplier              !== undefined && { supplier: supplier || null }),
        ...(supplierAvailability !== undefined && { supplierAvailability: supplierAvailability || null }),
        ...(active                !== undefined && { active: !!active }),
      },
    })

    return NextResponse.json({ data: product })
  } catch (error) {
    console.error('[PRODUCTS PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    await db.product.deleteMany({ where: { id: params.id, organizationId: payload.orgId } })
    return NextResponse.json({ message: 'Producto eliminado' })
  } catch (error) {
    console.error('[PRODUCTS DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
