import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { puedeVerEntregas } from '@/lib/stock-access'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

interface Params { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerEntregas(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const e = await db.entregaStock.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      include: {
        empresa: { select: { id: true, name: true } },
        items: {
          orderBy: { createdAt: 'asc' },
          include: { product: { select: { id: true, name: true, unit: true, stock: true, stockReservado: true, trackStock: true } } },
        },
      },
    })
    if (!e) return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 })

    const deal = e.dealId
      ? await db.deal.findFirst({ where: { id: e.dealId, organizationId: payload.orgId }, select: { id: true, title: true } })
      : null
    const cotizacion = e.cotizacionId
      ? await db.cotizacion.findFirst({ where: { id: e.cotizacionId, organizationId: payload.orgId }, select: { id: true, ref: true } })
      : null
    const org = await prisma.organization.findUnique({
      where: { id: payload.orgId },
      select: { name: true, crmName: true, primaryColor: true, logoUrl: true },
    })

    return NextResponse.json({
      data: {
        ...e,
        fecha: e.fecha.toISOString(),
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
        deal,
        cotizacion,
        org: { name: org?.name || org?.crmName || 'CRM', primaryColor: org?.primaryColor || '#6366f1', logoUrl: org?.logoUrl ?? null },
      },
    })
  } catch (error) {
    console.error('[ENTREGA GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PATCH — sólo BORRADOR. Reemplaza ítems + cabecera y reajusta las reservas
// (Product.stockReservado) por la diferencia entre lo reservado antes y ahora.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerEntregas(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const entrega = await db.entregaStock.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      include: { items: true },
    })
    if (!entrega) return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 })
    if (entrega.estado !== 'BORRADOR') {
      return NextResponse.json({ error: 'Sólo se puede editar una entrega en borrador' }, { status: 409 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

    const header: Record<string, unknown> = {}
    if (body.retiradoPor !== undefined) {
      if (!body.retiradoPor?.trim()) return NextResponse.json({ error: 'Indicá quién retira' }, { status: 400 })
      header.retiradoPor = body.retiradoPor.trim()
    }
    if (body.motivo !== undefined) header.motivo = body.motivo?.trim() || null
    if (body.fecha !== undefined && body.fecha && !isNaN(Date.parse(body.fecha))) header.fecha = new Date(body.fecha)
    if (body.dealId !== undefined) {
      if (body.dealId) {
        const deal = await db.deal.findFirst({ where: { id: body.dealId, organizationId: payload.orgId }, select: { id: true } })
        if (!deal) return NextResponse.json({ error: 'Obra no encontrada' }, { status: 400 })
      }
      header.dealId = body.dealId || null
    }

    await db.$transaction(async (tx: any) => {
      if (Array.isArray(body.items)) {
        const ids = Array.from(new Set(body.items.map((i: any) => i.productId).filter(Boolean))) as string[]
        const productos = ids.length
          ? await tx.product.findMany({ where: { id: { in: ids }, organizationId: payload.orgId }, select: { id: true, name: true, costo: true } })
          : []
        if (productos.length !== ids.length) throw Object.assign(new Error('Algún producto no es de esta organización'), { status: 400 })
        const byId = new Map(productos.map((p: any) => [p.id, p]))

        // Reserva anterior por producto.
        const reservaAntes = new Map<string, number>()
        for (const it of entrega.items) {
          if (!it.productId) continue
          reservaAntes.set(it.productId, (reservaAntes.get(it.productId) ?? 0) + it.cantidad)
        }

        const nuevos = body.items
          .filter((it: any) => it.productId && Number(it.cantidad) > 0)
          .map((it: any) => {
            const p: any = byId.get(it.productId)
            return {
              productId: it.productId,
              nombre: (it.nombre?.trim() || p?.name) ?? 'Producto',
              cantidad: Math.max(1, Math.round(Number(it.cantidad) || 1)),
              costoUnitario: p?.costo ?? null,
            }
          })
        const reservaDespues = new Map<string, number>()
        for (const it of nuevos) reservaDespues.set(it.productId, (reservaDespues.get(it.productId) ?? 0) + it.cantidad)

        await tx.entregaStockItem.deleteMany({ where: { entregaId: params.id } })
        for (const it of nuevos) await tx.entregaStockItem.create({ data: { entregaId: params.id, ...it } })

        // Ajustar reservas por el delta.
        const todos = Array.from(new Set(
          Array.from(reservaAntes.keys()).concat(Array.from(reservaDespues.keys())),
        ))
        for (const pid of todos) {
          const delta = (reservaDespues.get(pid) ?? 0) - (reservaAntes.get(pid) ?? 0)
          if (delta !== 0) {
            await tx.product.updateMany({
              where: { id: pid, organizationId: payload.orgId, trackStock: true },
              data: { stockReservado: { increment: delta } },
            })
          }
        }
      }
      if (Object.keys(header).length) await tx.entregaStock.update({ where: { id: params.id }, data: header })
    })

    return NextResponse.json({ data: { id: params.id } })
  } catch (error: any) {
    if (error?.status) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('[ENTREGA PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar la entrega' }, { status: 500 })
  }
}

// DELETE — sólo BORRADOR: libera reservas y borra.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerEntregas(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const entrega = await db.entregaStock.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      include: { items: true },
    })
    if (!entrega) return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 })
    if (entrega.estado !== 'BORRADOR') {
      return NextResponse.json({ error: 'Una entrega confirmada se anula, no se elimina' }, { status: 409 })
    }

    await db.$transaction(async (tx: any) => {
      for (const it of entrega.items) {
        if (!it.productId) continue
        const prod = await tx.product.findFirst({ where: { id: it.productId, organizationId: payload.orgId }, select: { id: true, stockReservado: true } })
        if (prod && prod.stockReservado > 0) {
          await tx.product.update({ where: { id: prod.id }, data: { stockReservado: { decrement: Math.min(prod.stockReservado, it.cantidad) } } })
        }
      }
      if (entrega.cotizacionId) {
        await tx.cotizacion.updateMany({ where: { id: entrega.cotizacionId, organizationId: payload.orgId }, data: { entregaGenerada: false } })
      }
      await tx.entregaStock.delete({ where: { id: params.id } })
    })

    return NextResponse.json({ message: 'Entrega eliminada' })
  } catch (error) {
    console.error('[ENTREGA DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar la entrega' }, { status: 500 })
  }
}
