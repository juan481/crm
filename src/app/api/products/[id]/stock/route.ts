import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isValidTipoMovimiento, nextStock } from '@/lib/stock'

interface Params { params: { id: string } }

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = prisma as any
    const product = await db.product.findFirst({ where: { id: params.id, organizationId: payload.orgId } })
    if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

    const movimientos = await db.stockMovimiento.findMany({
      where:   { productId: params.id, organizationId: payload.orgId },
      orderBy: { createdAt: 'desc' },
      take:    100,
    })

    return NextResponse.json({ data: { stock: product.stock, trackStock: product.trackStock, movimientos } })
  } catch (error) {
    console.error('[STOCK GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    const { tipo, cantidad, motivo, signo } = body

    if (!isValidTipoMovimiento(tipo)) {
      return NextResponse.json({ error: `Tipo de movimiento inválido: "${tipo}"` }, { status: 400 })
    }
    const cantidadNum = Number(cantidad)
    if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) {
      return NextResponse.json({ error: 'La cantidad debe ser un número mayor a 0' }, { status: 400 })
    }

    const db = prisma as any

    // $transaction: el nuevo stock y el movimiento que lo justifica se
    // escriben juntos o no se escribe ninguno — mismo criterio de atomicidad
    // que ya se usó para mirrorAsistencia (evita que dos ajustes simultáneos
    // pisen el stock resultante del otro).
    const result = await db.$transaction(async (tx: any) => {
      const product = await tx.product.findFirst({ where: { id: params.id, organizationId: payload.orgId } })
      if (!product) return { error: 'Producto no encontrado', status: 404 }

      const nuevoStock = nextStock(product.stock, tipo, cantidadNum, signo === -1 ? -1 : 1)
      if (nuevoStock < 0) {
        return { error: `No hay stock suficiente — quedarían ${nuevoStock} unidades. Stock actual: ${product.stock}.`, status: 400 }
      }

      const updated = await tx.product.update({ where: { id: params.id }, data: { stock: nuevoStock } })
      const movimiento = await tx.stockMovimiento.create({
        data: {
          productId: params.id,
          organizationId: payload.orgId,
          tipo, cantidad: cantidadNum, stockResultante: nuevoStock,
          motivo: motivo || null,
          creadoPorId: payload.userId,
        },
      })
      return { product: updated, movimiento }
    })

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    console.error('[STOCK POST]', error)
    return NextResponse.json({ error: 'Error al registrar el movimiento' }, { status: 500 })
  }
}
