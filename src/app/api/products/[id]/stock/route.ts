import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isValidTipoMovimiento } from '@/lib/stock'

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
    const delta = tipo === 'Entrada' ? cantidadNum : tipo === 'Salida' ? -cantidadNum : cantidadNum * (signo === -1 ? -1 : 1)

    // UPDATE atómico condicionado (WHERE ... stock + delta >= 0), no
    // "leer stock, calcular, después update" — con leer-y-escribir por
    // separado, dos ajustes simultáneos sobre el mismo producto (bug real
    // encontrado en revisión: dos admins ajustando el mismo producto a la
    // vez) pueden leer el mismo stock viejo y el segundo UPDATE pisa el
    // resultado del primero, perdiendo un movimiento en silencio. El UPDATE
    // condicionado hace que Postgres serialice ambas escrituras por el lock
    // de fila y sólo la que efectivamente corresponde pasa el WHERE.
    const result = await db.$transaction(async (tx: any) => {
      const rows: { stock: number }[] = await tx.$queryRaw`
        UPDATE "Product"
        SET stock = stock + ${delta}
        WHERE id = ${params.id} AND "organizationId" = ${payload.orgId} AND stock + ${delta} >= 0
        RETURNING stock
      `
      if (rows.length === 0) {
        // Discrimina "no existe/no es de esta org" de "se quedaría negativo"
        // — el UPDATE de arriba no distingue por qué no afectó ninguna fila.
        const existing = await tx.product.findFirst({ where: { id: params.id, organizationId: payload.orgId }, select: { stock: true } })
        if (!existing) return { error: 'Producto no encontrado', status: 404 }
        return { error: `No hay stock suficiente — quedarían ${existing.stock + delta} unidades. Stock actual: ${existing.stock}.`, status: 400 }
      }

      const nuevoStock = rows[0].stock
      const movimiento = await tx.stockMovimiento.create({
        data: {
          productId: params.id,
          organizationId: payload.orgId,
          tipo, cantidad: cantidadNum, stockResultante: nuevoStock,
          motivo: motivo || null,
          creadoPorId: payload.userId,
        },
      })
      return { product: { stock: nuevoStock }, movimiento }
    })

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    console.error('[STOCK POST]', error)
    return NextResponse.json({ error: 'Error al registrar el movimiento' }, { status: 500 })
  }
}
