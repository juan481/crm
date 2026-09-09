import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { puedeVerCompras } from '@/lib/stock-access'
import { crearCompra, confirmarCompra } from '@/lib/compras'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// GET /api/compras — lista de compras.
//   ?estado= ?estadoPago= ?proveedorId= ?dealId= ?search= ?page= ?limit=
export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
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
    eq('estadoPago', sp.get('estadoPago'))
    eq('proveedorId', sp.get('proveedorId'))
    eq('dealId', sp.get('dealId'))

    const search = (sp.get('search') ?? '').trim()
    if (search.length >= 2) {
      where.OR = [
        { numeroComprobante: { contains: search, mode: 'insensitive' } },
        { notas: { contains: search, mode: 'insensitive' } },
        { proveedor: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [rows, total] = await Promise.all([
      db.compra.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip, take: limit,
        select: {
          id: true, numero: true, numeroComprobante: true, tipoComprobante: true,
          fecha: true, moneda: true, subtotal: true, iva: true, total: true,
          estado: true, estadoPago: true, vencimiento: true, dealId: true,
          documentoId: true, createdAt: true,
          proveedor: { select: { id: true, name: true } },
          _count: { select: { items: true, pagos: true } },
          pagos: { select: { monto: true } },
        },
      }),
      db.compra.count({ where }),
    ])

    const data = rows.map((c: any) => {
      const pagado = c.pagos.reduce((s: number, p: any) => s + p.monto, 0)
      return {
        id: c.id,
        numero: c.numero,
        numeroComprobante: c.numeroComprobante,
        tipoComprobante: c.tipoComprobante,
        fecha: c.fecha.toISOString(),
        moneda: c.moneda,
        subtotal: c.subtotal,
        iva: c.iva,
        total: c.total,
        estado: c.estado,
        estadoPago: c.estadoPago,
        vencimiento: c.vencimiento ? c.vencimiento.toISOString() : null,
        dealId: c.dealId,
        documentoId: c.documentoId,
        createdAt: c.createdAt.toISOString(),
        proveedor: c.proveedor,
        itemsCount: c._count.items,
        pagado,
        saldo: Math.max(0, c.total - pagado),
      }
    })

    return NextResponse.json({ data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) })
  } catch (error) {
    console.error('[COMPRAS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST /api/compras — crea una compra (BORRADOR) con sus ítems. Si el body
// trae `confirmar: true`, la confirma en la misma transacción (ingresa stock
// + genera alertas de costo). Este es el endpoint que llama la pantalla de
// revisión del OCR y también la carga manual.
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body || !Array.isArray(body.items)) {
      return NextResponse.json({ error: 'Faltan los ítems de la compra' }, { status: 400 })
    }
    if (body.items.length === 0) {
      return NextResponse.json({ error: 'La compra no tiene ningún ítem' }, { status: 400 })
    }

    const db = prisma as any

    // Validar FKs de esta org.
    if (body.proveedorId) {
      const prov = await db.empresa.findFirst({ where: { id: body.proveedorId, organizationId: payload.orgId }, select: { id: true } })
      if (!prov) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 400 })
    }
    if (body.dealId) {
      const deal = await db.deal.findFirst({ where: { id: body.dealId, organizationId: payload.orgId }, select: { id: true } })
      if (!deal) return NextResponse.json({ error: 'Obra / oportunidad no encontrada' }, { status: 400 })
    }
    const productIds = Array.from(new Set(body.items.map((i: any) => i.productId).filter(Boolean))) as string[]
    if (productIds.length) {
      const found = await db.product.count({ where: { id: { in: productIds }, organizationId: payload.orgId } })
      if (found !== productIds.length) return NextResponse.json({ error: 'Algún producto no es de esta organización' }, { status: 400 })
    }

    const result = await db.$transaction(async (tx: any) => {
      const { id } = await crearCompra(tx, {
        organizationId: payload.orgId,
        creadoPorId: payload.userId,
        proveedorId: body.proveedorId,
        numeroComprobante: body.numeroComprobante,
        tipoComprobante: body.tipoComprobante,
        fecha: body.fecha,
        moneda: body.moneda,
        subtotal: body.subtotal,
        iva: body.iva,
        total: body.total,
        dealId: body.dealId,
        documentoId: body.documentoId,
        vencimiento: body.vencimiento,
        notas: body.notas,
        ocrRaw: body.ocrRaw,
        items: body.items,
      })

      if (body.confirmar === true) {
        const conf = await confirmarCompra(tx, id, payload.orgId, payload.userId)
        if (!conf.ok) throw Object.assign(new Error(conf.error), { status: conf.status })
        return { id, ...conf }
      }
      return { id, ok: false as const }
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error: any) {
    if (error?.status) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('[COMPRAS POST]', error)
    return NextResponse.json({ error: 'Error al guardar la compra' }, { status: 500 })
  }
}
