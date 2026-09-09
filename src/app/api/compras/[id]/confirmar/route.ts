import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { puedeVerCompras } from '@/lib/stock-access'
import { confirmarCompra } from '@/lib/compras'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// POST /api/compras/[id]/confirmar — BORRADOR → CONFIRMADA. Ingresa el stock
// (StockMovimiento Entrada, origen COMPRA) y genera las alertas de costo.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const result = await db.$transaction((tx: any) => confirmarCompra(tx, params.id, payload.orgId, payload.userId))

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ data: result })
  } catch (error: any) {
    // P2002 en el @@unique([organizationId, numero]) = dos confirmaciones
    // simultáneas tomaron el mismo número. Reintento simple.
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Otra compra se confirmó al mismo tiempo — probá de nuevo.' }, { status: 409 })
    }
    console.error('[COMPRA CONFIRMAR]', error)
    return NextResponse.json({ error: 'Error al confirmar la compra' }, { status: 500 })
  }
}
