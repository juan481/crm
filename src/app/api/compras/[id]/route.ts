import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { puedeVerCompras } from '@/lib/stock-access'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

interface Params { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const c = await db.compra.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      include: {
        proveedor: { select: { id: true, name: true, cuit: true, cbu: true, alias: true } },
        items: { orderBy: { createdAt: 'asc' } },
        pagos: { orderBy: { fecha: 'desc' } },
      },
    })
    if (!c) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })

    // Documento adjunto (sin FK, se resuelve a mano).
    const documento = c.documentoId
      ? await db.document.findFirst({ where: { id: c.documentoId, organizationId: payload.orgId }, select: { id: true, url: true, mimeType: true, originalName: true } })
      : null

    // Deal vinculado (título, para mostrar).
    const deal = c.dealId
      ? await db.deal.findFirst({ where: { id: c.dealId, organizationId: payload.orgId }, select: { id: true, title: true } })
      : null

    // Movimientos de stock generados por esta compra.
    const movimientos = await db.stockMovimiento.findMany({
      where: { organizationId: payload.orgId, compraId: c.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, tipo: true, cantidad: true, stockResultante: true, productId: true, product: { select: { name: true } } },
    })

    const pagado = c.pagos.reduce((s: number, p: any) => s + p.monto, 0)

    return NextResponse.json({
      data: {
        ...c,
        fecha: c.fecha.toISOString(),
        vencimiento: c.vencimiento ? c.vencimiento.toISOString() : null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        pagos: c.pagos.map((p: any) => ({ ...p, fecha: p.fecha.toISOString(), createdAt: p.createdAt.toISOString() })),
        pagado,
        saldo: Math.max(0, c.total - pagado),
        documento,
        deal,
        movimientos,
      },
    })
  } catch (error) {
    console.error('[COMPRA GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PATCH — sólo se puede editar una compra en BORRADOR. Reemplaza cabecera +
// ítems completos (la pantalla de edición manda todo).
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const existing = await db.compra.findFirst({ where: { id: params.id, organizationId: payload.orgId }, select: { id: true, estado: true } })
    if (!existing) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    if (existing.estado !== 'BORRADOR') {
      return NextResponse.json({ error: 'Sólo se puede editar una compra en borrador' }, { status: 409 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

    const num = (v: unknown): number => {
      const x = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN
      return Number.isFinite(x) ? x : 0
    }

    const data: Record<string, unknown> = {}
    if (body.proveedorId !== undefined) {
      if (body.proveedorId) {
        const prov = await db.empresa.findFirst({ where: { id: body.proveedorId, organizationId: payload.orgId }, select: { id: true } })
        if (!prov) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 400 })
      }
      data.proveedorId = body.proveedorId || null
    }
    if (body.dealId !== undefined) {
      if (body.dealId) {
        const deal = await db.deal.findFirst({ where: { id: body.dealId, organizationId: payload.orgId }, select: { id: true } })
        if (!deal) return NextResponse.json({ error: 'Obra no encontrada' }, { status: 400 })
      }
      data.dealId = body.dealId || null
    }
    if (body.numeroComprobante !== undefined) data.numeroComprobante = body.numeroComprobante?.trim() || null
    if (body.tipoComprobante !== undefined) data.tipoComprobante = body.tipoComprobante?.trim() || null
    if (body.fecha !== undefined && body.fecha && !isNaN(Date.parse(body.fecha))) data.fecha = new Date(body.fecha)
    if (body.moneda !== undefined) data.moneda = (body.moneda || 'ARS').toUpperCase()
    if (body.iva !== undefined) data.iva = num(body.iva)
    if (body.subtotal !== undefined) data.subtotal = num(body.subtotal)
    if (body.total !== undefined) data.total = num(body.total)
    if (body.vencimiento !== undefined) data.vencimiento = body.vencimiento && !isNaN(Date.parse(body.vencimiento)) ? new Date(body.vencimiento) : null
    if (body.notas !== undefined) data.notas = body.notas?.trim() || null
    if (body.documentoId !== undefined) data.documentoId = body.documentoId || null

    await db.$transaction(async (tx: any) => {
      if (Array.isArray(body.items)) {
        const productIds = Array.from(new Set(body.items.map((i: any) => i.productId).filter(Boolean))) as string[]
        if (productIds.length) {
          const found = await tx.product.count({ where: { id: { in: productIds }, organizationId: payload.orgId } })
          if (found !== productIds.length) throw Object.assign(new Error('Algún producto no es de esta organización'), { status: 400 })
        }
        await tx.compraItem.deleteMany({ where: { compraId: params.id } })
        const items = body.items.filter((it: any) => it.nombre?.trim())
        const subtotalItems = items.reduce((s: number, it: any) => s + num(it.costoUnitario) * Math.max(1, Math.round(num(it.cantidad) || 1)), 0)
        for (const it of items) {
          const cant = Math.max(1, Math.round(num(it.cantidad) || 1))
          await tx.compraItem.create({
            data: {
              compraId: params.id,
              productId: it.productId || null,
              sku: it.sku?.trim() || null,
              nombre: it.nombre.trim(),
              cantidad: cant,
              costoUnitario: num(it.costoUnitario),
              subtotal: num(it.costoUnitario) * cant,
            },
          })
        }
        if (body.subtotal === undefined) data.subtotal = subtotalItems
        if (body.total === undefined) data.total = subtotalItems + num(data.iva ?? 0)
      }
      await tx.compra.update({ where: { id: params.id }, data })
    })

    return NextResponse.json({ data: { id: params.id } })
  } catch (error: any) {
    if (error?.status) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('[COMPRA PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar la compra' }, { status: 500 })
  }
}

// DELETE — sólo BORRADOR. Una compra CONFIRMADA se anula (no se borra), para
// no perder el rastro de los movimientos de stock que generó.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const existing = await db.compra.findFirst({ where: { id: params.id, organizationId: payload.orgId }, select: { id: true, estado: true } })
    if (!existing) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    if (existing.estado !== 'BORRADOR') {
      return NextResponse.json({ error: 'Sólo se puede eliminar una compra en borrador. Una compra confirmada se anula.' }, { status: 409 })
    }

    await db.compra.delete({ where: { id: params.id } })
    return NextResponse.json({ message: 'Compra eliminada' })
  } catch (error) {
    console.error('[COMPRA DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar la compra' }, { status: 500 })
  }
}
