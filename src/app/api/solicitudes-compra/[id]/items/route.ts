import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { puedeVerCompras } from '@/lib/stock-access'
import { prisma } from '@/lib/db'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// Agregar un ítem al pedido — sólo mientras es BORRADOR. productId opcional
// (un ítem manual, sin matchear al catálogo, sigue siendo válido — mismo
// criterio que CompraItem).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const solicitud = await db.solicitudCompra.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true, estado: true },
    })
    if (!solicitud) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    if (solicitud.estado !== 'BORRADOR') {
      return NextResponse.json({ error: 'Ya se envió — no se pueden agregar ítems' }, { status: 409 })
    }

    const body = await req.json()
    const { productId, sku, nombre, cantidad, costoUnitario, moneda } = body

    let resolvedProduct: { id: string; sku: string | null; name: string; costo: number | null; currency: string } | null = null
    if (productId) {
      resolvedProduct = await db.product.findFirst({
        where: { id: productId, organizationId: payload.orgId },
        select: { id: true, sku: true, name: true, costo: true, currency: true },
      })
      if (!resolvedProduct) return NextResponse.json({ error: 'Producto no encontrado en esta organización' }, { status: 400 })
    }

    const nombreFinal = (nombre?.trim() || resolvedProduct?.name || '').trim()
    if (!nombreFinal) return NextResponse.json({ error: 'Falta el nombre del producto' }, { status: 400 })

    const cantidadFinal = Math.max(1, Math.round(Number(cantidad) || 1))
    // costoUnitario explícito tiene prioridad (Seba puede corregirlo a
    // mano si tiene un precio más nuevo que el del catálogo) — si no vino,
    // se precarga del Product.costo sincronizado del importador.
    const costoFinal = costoUnitario !== undefined && costoUnitario !== ''
      ? Number(costoUnitario)
      : (resolvedProduct?.costo ?? 0)
    if (!Number.isFinite(costoFinal) || costoFinal < 0) {
      return NextResponse.json({ error: 'El costo no es válido' }, { status: 400 })
    }

    const item = await db.solicitudCompraItem.create({
      data: {
        solicitudId: params.id,
        productId: resolvedProduct?.id ?? null,
        sku: sku?.trim() || resolvedProduct?.sku || null,
        nombre: nombreFinal,
        cantidad: cantidadFinal,
        costoUnitario: costoFinal,
        moneda: (moneda || resolvedProduct?.currency || 'USD').toUpperCase(),
      },
      select: {
        id: true, productId: true, sku: true, nombre: true, cantidad: true,
        costoUnitario: true, moneda: true, disponible: true,
      },
    })

    return NextResponse.json({ data: item }, { status: 201 })
  } catch (error) {
    console.error('[SOLICITUD COMPRA ITEM POST]', error)
    return NextResponse.json({ error: 'Error al agregar el ítem' }, { status: 500 })
  }
}
