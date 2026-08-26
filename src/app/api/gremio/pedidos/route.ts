import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserAny } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createWithSequence } from '@/lib/sequence'
import { findUserByEmail } from '@/lib/users'
import { getPluginConfig } from '@/lib/plugins'
import { notifyGremioOrder } from '@/lib/gremio-notify'

export const dynamic = 'force-dynamic'

// GREMIO es un carril lateral (portal B2B) — chequeo directo de rol, nunca
// canAccess() a secas (con GREMIO:-1 en la jerarquía, cualquier canAccess
// contra un piso real daría siempre false). Ver comentario en
// src/lib/auth.ts.
export async function GET() {
  try {
    const payload = await getCurrentUserAny()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (payload.role !== 'GREMIO') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    // Scopeado siempre a userId — un usuario Gremio nunca ve pedidos de otro.
    const pedidos = await db.pedido.findMany({
      where: { organizationId: payload.orgId, userId: payload.userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: pedidos })
  } catch (error) {
    console.error('[GREMIO PEDIDOS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

interface RawItem { productId: string; quantity: number }

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUserAny()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (payload.role !== 'GREMIO') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { items: rawItems, notes } = (await req.json()) as { items: RawItem[]; notes?: string }
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 })
    }

    const db = prisma as any

    // Los precios NUNCA se confían del cliente — se resuelven server-side
    // contra el Product real de esta organización (mismo criterio que
    // api/cotizador/send/route.ts recalculando total a partir de items).
    const productIds = Array.from(new Set(rawItems.map((i) => i.productId).filter(Boolean)))
    const products = await db.product.findMany({
      // price > 0 — hay ~68 productos "placeholder" en el catálogo del
      // proveedor sin cotizar todavía (costo=precioGremio=precioPublico=0,
      // importados igual para que Abba los vea y los complete). Sin este
      // filtro, un usuario Gremio podía agregarlos al carrito y confirmar
      // un pedido real con ítems gratis — server-side es la barrera
      // autoritativa (la UI de /gremio/catalogo también los bloquea, pero
      // nunca hay que confiar sólo en eso).
      where: { id: { in: productIds }, organizationId: payload.orgId, active: true, price: { gt: 0 } },
      select: { id: true, sku: true, name: true, price: true, precioGremio: true, currency: true },
    })
    const productById = new Map<string, any>(products.map((p: any) => [p.id, p]))

    const itemsData: { productId: string; sku: string | null; name: string; precioGremio: number; precioPublico: number; quantity: number }[] = []
    let totalGremio = 0
    let totalPublico = 0
    let currency = 'USD'

    for (const raw of rawItems) {
      const product = productById.get(raw.productId)
      if (!product) continue // inexistente/dado de baja/sin precio cargado todavía — se descarta en silencio
      const quantity = Math.max(1, Math.floor(Number(raw.quantity)) || 1)
      // Fallback a price si el producto no tiene precioGremio propio (no
      // debería pasar para algo agregado desde /gremio/catalogo, que sólo
      // muestra productos de catálogo, pero cubre el caso defensivamente).
      const precioGremio = product.precioGremio ?? product.price
      const precioPublico = product.price
      currency = product.currency || currency
      totalGremio += precioGremio * quantity
      totalPublico += precioPublico * quantity
      itemsData.push({ productId: product.id, sku: product.sku, name: product.name, precioGremio, precioPublico, quantity })
    }

    if (itemsData.length === 0) {
      return NextResponse.json({ error: 'Ningún producto del carrito sigue disponible' }, { status: 400 })
    }

    const ahorro = totalPublico - totalGremio

    const config = (await getPluginConfig(payload.orgId, 'gremio-portal')) as
      | { assigneeEmail?: string; notifyEmail?: string }
      | null
    // Falla suave: si no matchea ningún usuario cargado (ej. Sebastian
    // Pierini todavía no tiene cuenta), el pedido se crea igual sin asignar.
    const assignee = config?.assigneeEmail ? await findUserByEmail(payload.orgId, config.assigneeEmail) : null

    const buyer = await db.user.findUnique({ where: { id: payload.userId }, select: { name: true, email: true } })

    const pedido = await createWithSequence<any>(db, 'pedido', payload.orgId, (number) =>
      db.pedido.create({
        data: {
          number,
          organizationId: payload.orgId,
          userId: payload.userId,
          assignedToId: assignee?.id ?? null,
          totalGremio,
          totalPublico,
          ahorro,
          currency,
          notes: notes?.trim() || null,
          items: { create: itemsData },
        },
        include: { items: true },
      })
    )

    notifyGremioOrder({
      pedidoId: pedido.id,
      number: pedido.number,
      buyerName: buyer?.name ?? payload.email,
      buyerEmail: buyer?.email ?? payload.email,
      items: itemsData,
      totalGremio,
      totalPublico,
      ahorro,
      currency,
      notifyEmail: config?.notifyEmail,
      notes: pedido.notes,
    })

    return NextResponse.json({ data: pedido }, { status: 201 })
  } catch (error) {
    console.error('[GREMIO PEDIDOS POST]', error)
    return NextResponse.json({ error: 'Error al crear el pedido' }, { status: 500 })
  }
}
