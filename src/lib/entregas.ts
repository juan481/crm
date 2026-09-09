import { registrarMovimiento } from '@/lib/stock'

// Egresos de stock (remitos internos). Preparar reserva; entregar descuenta.

export interface ItemEntregaInput {
  productId: string
  nombre?: string | null
  cantidad: number
}

interface LineaExpandida {
  productId: string
  nombre: string
  cantidad: number
  costoUnitario: number | null
}

// Expande los items PRODUCT de una cotización a líneas de material real:
// un KIT se abre a sus ProductComponent (cantidad × cantidad del renglón);
// un producto simple queda tal cual. Los SERVICE se ignoran.
export async function expandirItemsCotizacion(
  tx: any,
  orgId: string,
  items: any[],
): Promise<LineaExpandida[]> {
  const productItems = (Array.isArray(items) ? items : []).filter(
    (it) => it?.type === 'PRODUCT' && it?.productId && Number(it.quantity) > 0,
  )
  if (productItems.length === 0) return []

  const ids = Array.from(new Set(productItems.map((it) => it.productId as string)))
  const productos = await tx.product.findMany({
    where: { id: { in: ids }, organizationId: orgId },
    select: {
      id: true, name: true, isKit: true, costo: true, trackStock: true,
      kitComponents: {
        select: { quantity: true, component: { select: { id: true, name: true, costo: true, trackStock: true } } },
      },
    },
  })
  const byId = new Map<string, any>(productos.map((p: any) => [p.id, p]))

  const acc = new Map<string, LineaExpandida>()
  const add = (productId: string, nombre: string, cantidad: number, costo: number | null) => {
    const prev = acc.get(productId)
    if (prev) prev.cantidad += cantidad
    else acc.set(productId, { productId, nombre, cantidad, costoUnitario: costo })
  }

  for (const it of productItems) {
    const qty = Math.max(1, Math.round(Number(it.quantity) || 1))
    const prod = byId.get(it.productId)
    if (!prod) { add(it.productId, it.name ?? 'Producto', qty, null); continue }
    if (prod.isKit && prod.kitComponents.length > 0) {
      for (const kc of prod.kitComponents) {
        add(kc.component.id, kc.component.name, qty * (kc.quantity || 1), kc.component.costo ?? null)
      }
    } else {
      add(prod.id, prod.name, qty, prod.costo ?? null)
    }
  }

  return Array.from(acc.values())
}

export interface PrepararResult { ok: true; entregaId: string; lineas: number }
export interface PrepararError { ok: false; error: string; status: number }

// Cotización ACEPTADA → EntregaStock BORRADOR con el material expandido +
// Product.stockReservado += cantidad (soft-reserve, no toca stock real).
export async function prepararEntregaDesdeCotizacion(
  tx: any,
  cotizacionId: string,
  orgId: string,
  userId: string,
): Promise<PrepararResult | PrepararError> {
  const cot = await tx.cotizacion.findFirst({
    where: { id: cotizacionId, organizationId: orgId },
    select: { id: true, ref: true, items: true, dealId: true, empresaId: true, status: true, entregaGenerada: true },
  })
  if (!cot) return { ok: false, error: 'Cotización no encontrada', status: 404 }
  if (cot.entregaGenerada) return { ok: false, error: 'Ya se preparó el material de esta cotización', status: 409 }
  if (cot.status !== 'ACEPTADA') return { ok: false, error: 'La cotización tiene que estar aceptada para preparar el material', status: 409 }

  const lineas = await expandirItemsCotizacion(tx, orgId, cot.items as any[])
  if (lineas.length === 0) return { ok: false, error: 'La cotización no tiene productos físicos para preparar', status: 400 }

  const entrega = await tx.entregaStock.create({
    data: {
      organizationId: orgId,
      dealId: cot.dealId,
      cotizacionId: cot.id,
      empresaId: cot.empresaId,
      retiradoPor: 'A definir',
      motivo: `Materiales del presupuesto ${cot.ref}`,
      estado: 'BORRADOR',
      creadoPorId: userId,
      items: {
        create: lineas.map((l) => ({
          productId: l.productId,
          nombre: l.nombre,
          cantidad: l.cantidad,
          costoUnitario: l.costoUnitario,
        })),
      },
    },
    select: { id: true },
  })

  // Reservar — sólo productos trackeados.
  for (const l of lineas) {
    await tx.product.updateMany({
      where: { id: l.productId, organizationId: orgId, trackStock: true },
      data: { stockReservado: { increment: l.cantidad } },
    })
  }

  await tx.cotizacion.update({ where: { id: cot.id }, data: { entregaGenerada: true } })

  return { ok: true, entregaId: entrega.id, lineas: lineas.length }
}

export interface EntregarResult { ok: true; numero: number; movimientos: number }
export interface EntregarError { ok: false; error: string; status: number }

// BORRADOR → ENTREGADA: por cada ítem con producto trackeado, Salida (origen
// VENTA, entregaId, dealId) + libera la reserva. Historial inmutable.
export async function entregarEntrega(
  tx: any,
  entregaId: string,
  orgId: string,
  userId: string,
): Promise<EntregarResult | EntregarError> {
  const entrega = await tx.entregaStock.findFirst({
    where: { id: entregaId, organizationId: orgId },
    include: { items: true },
  })
  if (!entrega) return { ok: false, error: 'Entrega no encontrada', status: 404 }
  if (entrega.estado === 'ENTREGADA') return { ok: false, error: 'La entrega ya fue confirmada', status: 409 }
  if (entrega.estado === 'ANULADA') return { ok: false, error: 'La entrega está anulada', status: 409 }
  if (entrega.items.length === 0) return { ok: false, error: 'La entrega no tiene ítems', status: 400 }

  const last = await tx.entregaStock.findFirst({
    where: { organizationId: orgId, numero: { not: null } },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  })
  const numero = (last?.numero ?? 0) + 1

  let movimientos = 0
  for (const it of entrega.items) {
    if (!it.productId) continue
    const prod = await tx.product.findFirst({
      where: { id: it.productId, organizationId: orgId },
      select: { id: true, trackStock: true, stockReservado: true },
    })
    if (!prod) continue

    // Liberar la reserva (aunque el producto ya no trackee stock). decrement
    // acotado a lo que hay reservado — nunca queda negativo.
    if (prod.stockReservado > 0) {
      await tx.product.update({
        where: { id: prod.id },
        data: { stockReservado: { decrement: Math.min(prod.stockReservado, it.cantidad) } },
      })
    }

    if (prod.trackStock) {
      const res = await registrarMovimiento(tx, {
        productId: it.productId,
        organizationId: orgId,
        tipo: 'Salida',
        cantidad: it.cantidad,
        origen: 'VENTA',
        motivo: `Entrega ${numero}${entrega.motivo ? ` — ${entrega.motivo}` : ''}`.slice(0, 200),
        creadoPorId: userId,
        entregaId: entrega.id,
        dealId: entrega.dealId,
        costoUnitario: it.costoUnitario,
      })
      if (!res.ok) return { ok: false, error: `${it.nombre}: ${res.error}`, status: res.status }
      movimientos++
    }
  }

  await tx.entregaStock.update({
    where: { id: entrega.id },
    data: { estado: 'ENTREGADA', numero, fecha: new Date() },
  })

  return { ok: true, numero, movimientos }
}

// ENTREGADA → ANULADA: reingresa lo entregado (Entrada, origen AJUSTE).
// BORRADOR → ANULADA: sólo libera las reservas.
export async function anularEntrega(
  tx: any,
  entregaId: string,
  orgId: string,
  userId: string,
): Promise<{ ok: true; reingresos: number } | { ok: false; error: string; status: number }> {
  const entrega = await tx.entregaStock.findFirst({
    where: { id: entregaId, organizationId: orgId },
    include: { items: true },
  })
  if (!entrega) return { ok: false, error: 'Entrega no encontrada', status: 404 }
  if (entrega.estado === 'ANULADA') return { ok: false, error: 'Ya está anulada', status: 409 }

  let reingresos = 0
  if (entrega.estado === 'BORRADOR') {
    for (const it of entrega.items) {
      if (!it.productId) continue
      const prod = await tx.product.findFirst({ where: { id: it.productId, organizationId: orgId }, select: { id: true, stockReservado: true } })
      if (prod && prod.stockReservado > 0) {
        await tx.product.update({ where: { id: prod.id }, data: { stockReservado: { decrement: Math.min(prod.stockReservado, it.cantidad) } } })
      }
    }
  } else if (entrega.estado === 'ENTREGADA') {
    for (const it of entrega.items) {
      if (!it.productId) continue
      const prod = await tx.product.findFirst({ where: { id: it.productId, organizationId: orgId }, select: { trackStock: true } })
      if (!prod?.trackStock) continue
      const res = await registrarMovimiento(tx, {
        productId: it.productId,
        organizationId: orgId,
        tipo: 'Entrada',
        cantidad: it.cantidad,
        origen: 'AJUSTE',
        motivo: `Anulación de entrega ${entrega.numero ?? ''}`.trim(),
        creadoPorId: userId,
        entregaId: entrega.id,
        dealId: entrega.dealId,
        costoUnitario: it.costoUnitario,
      })
      if (!res.ok) return { ok: false, error: `${it.nombre}: ${res.error}`, status: res.status }
      reingresos++
    }
  }

  // Si venía de una cotización, permitir volver a preparar.
  if (entrega.cotizacionId) {
    await tx.cotizacion.updateMany({ where: { id: entrega.cotizacionId, organizationId: orgId }, data: { entregaGenerada: false } })
  }
  await tx.entregaStock.update({ where: { id: entrega.id }, data: { estado: 'ANULADA' } })

  return { ok: true, reingresos }
}
