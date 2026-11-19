import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { puedeVerCompras } from '@/lib/stock-access'
import { prisma } from '@/lib/db'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// POST /api/solicitudes-compra/[id]/duplicar — arma un BORRADOR nuevo con el
// mismo proveedor, condición de pago, notas, contacto e ítems (cantidad +
// costo tal cual estaban). Sirve para corregir un pedido anulado y
// reenviarlo, o para repetir un pedido viejo. Las respuestas del importador
// (disponible) no se copian: el pedido nuevo arranca sin respuesta. El
// número se asigna recién al enviarlo, como cualquier borrador.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const original = await db.solicitudCompra.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: {
        id: true, proveedorId: true, condicionPago: true, notas: true,
        contactoEmail: true, contactoNombre: true,
        items: {
          orderBy: { createdAt: 'asc' },
          select: { productId: true, sku: true, nombre: true, cantidad: true, costoUnitario: true, moneda: true },
        },
      },
    })
    if (!original) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    if (original.items.length === 0) return NextResponse.json({ error: 'El pedido no tiene ítems para duplicar' }, { status: 400 })

    // Creados juntos, todos los ítems caerían en el mismo milisegundo y el
    // orden de la ficha (createdAt asc) quedaría al azar — se les da un
    // milisegundo de diferencia para respetar el orden original.
    const base = Date.now()
    const nuevo = await db.solicitudCompra.create({
      data: {
        organizationId: payload.orgId,
        creadoPorId: payload.userId,
        proveedorId: original.proveedorId,
        condicionPago: original.condicionPago,
        notas: original.notas,
        contactoEmail: original.contactoEmail,
        contactoNombre: original.contactoNombre,
        items: {
          create: original.items.map((it: any, i: number) => ({
            productId: it.productId,
            sku: it.sku,
            nombre: it.nombre,
            cantidad: it.cantidad,
            costoUnitario: it.costoUnitario,
            moneda: it.moneda,
            createdAt: new Date(base + i),
          })),
        },
      },
      select: { id: true },
    })

    return NextResponse.json({ message: 'Borrador creado con los mismos ítems', data: nuevo }, { status: 201 })
  } catch (error) {
    console.error('[SOLICITUD COMPRA DUPLICAR]', error)
    return NextResponse.json({ error: 'Error al duplicar el pedido' }, { status: 500 })
  }
}
