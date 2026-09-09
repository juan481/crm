import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { puedeVerEntregas } from '@/lib/stock-access'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// GET /api/entregas — lista de remitos internos.
//   ?estado= ?dealId= ?cotizacionId= ?search= ?page= ?limit=
export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerEntregas(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const sp = req.nextUrl.searchParams
    const page  = Math.max(1, Number(sp.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(sp.get('limit') ?? 30)))
    const skip  = (page - 1) * limit

    const db = prisma as any
    const where: Record<string, unknown> = { organizationId: payload.orgId }
    const eq = (k: string, v: string | null) => { if (v) where[k] = v }
    eq('estado', sp.get('estado'))
    eq('dealId', sp.get('dealId'))
    eq('cotizacionId', sp.get('cotizacionId'))

    const search = (sp.get('search') ?? '').trim()
    if (search.length >= 2) {
      where.OR = [
        { retiradoPor: { contains: search, mode: 'insensitive' } },
        { motivo: { contains: search, mode: 'insensitive' } },
        { empresa: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [rows, total] = await Promise.all([
      db.entregaStock.findMany({
        where, orderBy: { createdAt: 'desc' }, skip, take: limit,
        select: {
          id: true, numero: true, retiradoPor: true, motivo: true, estado: true,
          fecha: true, dealId: true, cotizacionId: true, createdAt: true,
          empresa: { select: { id: true, name: true } },
          _count: { select: { items: true } },
          items: { select: { cantidad: true, costoUnitario: true } },
        },
      }),
      db.entregaStock.count({ where }),
    ])

    const data = rows.map((e: any) => ({
      id: e.id,
      numero: e.numero,
      retiradoPor: e.retiradoPor,
      motivo: e.motivo,
      estado: e.estado,
      fecha: e.fecha.toISOString(),
      createdAt: e.createdAt.toISOString(),
      dealId: e.dealId,
      cotizacionId: e.cotizacionId,
      empresa: e.empresa,
      itemsCount: e._count.items,
      unidades: e.items.reduce((s: number, i: any) => s + i.cantidad, 0),
      costoTotal: e.items.reduce((s: number, i: any) => s + (i.costoUnitario ?? 0) * i.cantidad, 0),
    }))

    return NextResponse.json({ data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) })
  } catch (error) {
    console.error('[ENTREGAS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST /api/entregas — entrega manual (venta de mostrador o egreso suelto).
// Body: { retiradoPor, motivo?, empresaId?, dealId?, fecha?, items:[{productId, cantidad, nombre?}], entregar? }
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerEntregas(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Cargá al menos un ítem' }, { status: 400 })
    }
    if (!body.retiradoPor?.trim()) {
      return NextResponse.json({ error: 'Indicá quién retira el material' }, { status: 400 })
    }

    const db = prisma as any
    const ids = Array.from(new Set(body.items.map((i: any) => i.productId).filter(Boolean))) as string[]
    if (ids.length === 0) return NextResponse.json({ error: 'Los ítems necesitan un producto' }, { status: 400 })
    const productos = await db.product.findMany({
      where: { id: { in: ids }, organizationId: payload.orgId },
      select: { id: true, name: true, costo: true, trackStock: true },
    })
    if (productos.length !== ids.length) return NextResponse.json({ error: 'Algún producto no es de esta organización' }, { status: 400 })
    const byId = new Map(productos.map((p: any) => [p.id, p]))

    if (body.empresaId) {
      const emp = await db.empresa.findFirst({ where: { id: body.empresaId, organizationId: payload.orgId }, select: { id: true } })
      if (!emp) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 400 })
    }
    if (body.dealId) {
      const deal = await db.deal.findFirst({ where: { id: body.dealId, organizationId: payload.orgId }, select: { id: true } })
      if (!deal) return NextResponse.json({ error: 'Obra no encontrada' }, { status: 400 })
    }

    const items = body.items
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

    const result = await db.$transaction(async (tx: any) => {
      const entrega = await tx.entregaStock.create({
        data: {
          organizationId: payload.orgId,
          empresaId: body.empresaId || null,
          dealId: body.dealId || null,
          retiradoPor: body.retiradoPor.trim(),
          motivo: body.motivo?.trim() || null,
          fecha: body.fecha && !isNaN(Date.parse(body.fecha)) ? new Date(body.fecha) : new Date(),
          estado: 'BORRADOR',
          creadoPorId: payload.userId,
          items: { create: items },
        },
        select: { id: true },
      })

      // Reservar mientras es borrador.
      for (const it of items) {
        await tx.product.updateMany({
          where: { id: it.productId, organizationId: payload.orgId, trackStock: true },
          data: { stockReservado: { increment: it.cantidad } },
        })
      }

      if (body.entregar === true) {
        const { entregarEntrega } = await import('@/lib/entregas')
        const r = await entregarEntrega(tx, entrega.id, payload.orgId, payload.userId)
        if (!r.ok) throw Object.assign(new Error(r.error), { status: r.status })
        return { id: entrega.id, ...r }
      }
      return { id: entrega.id, ok: false as const }
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error: any) {
    if (error?.status) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('[ENTREGAS POST]', error)
    return NextResponse.json({ error: 'Error al crear la entrega' }, { status: 500 })
  }
}
