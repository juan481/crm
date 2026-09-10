import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import { prisma } from '@/lib/db'
import { isValidTipoMovimiento, registrarMovimiento } from '@/lib/stock'

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
    // Ajustar stock: ADMIN+, o el permiso de cargar catálogo, o el módulo
    // Depósito (un encargado de depósito ajusta stock desde /stock sin
    // necesitar tocar el catálogo).
    if (
      !canAccess(payload.role, 'ADMIN') &&
      !(await roleHasModule(payload.orgId, payload.role, 'catalogo-gestion')) &&
      !(await roleHasModule(payload.orgId, payload.role, 'stock'))
    ) {
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

    // El UPDATE atómico condicionado + el alta en el ledger viven en
    // registrarMovimiento() (src/lib/stock.ts) — mismo criterio de "no leer,
    // calcular y después escribir" que evita que dos ajustes simultáneos
    // sobre el mismo producto pierdan un movimiento en silencio. Este
    // endpoint es el ajuste MANUAL desde la UI; las compras (Fase 2) y las
    // entregas (Fase 3) llaman al mismo helper con otro `origen`.
    const result = await db.$transaction((tx: any) =>
      registrarMovimiento(tx, {
        productId: params.id,
        organizationId: payload.orgId,
        tipo,
        cantidad: cantidadNum,
        signoAjuste: tipo === 'Ajuste' ? (signo === -1 ? -1 : 1) : undefined,
        origen: 'MANUAL',
        motivo: motivo || null,
        creadoPorId: payload.userId,
      }),
    )

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    return NextResponse.json({
      data: { product: { stock: result.stockResultante }, movimiento: { id: result.movimientoId } },
    }, { status: 201 })
  } catch (error) {
    console.error('[STOCK POST]', error)
    return NextResponse.json({ error: 'Error al registrar el movimiento' }, { status: 500 })
  }
}
