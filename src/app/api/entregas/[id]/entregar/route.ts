import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { puedeVerEntregas } from '@/lib/stock-access'
import { entregarEntrega } from '@/lib/entregas'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// POST /api/entregas/[id]/entregar — BORRADOR → ENTREGADA. Descuenta el stock
// (StockMovimiento Salida, origen VENTA) y libera las reservas.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerEntregas(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    // Re-lanzar dentro de la transacción para que Prisma haga rollback si un
    // ítem no tiene stock a mitad del loop (el helper devuelve {ok:false}).
    const result = await db.$transaction(async (tx: any) => {
      const r = await entregarEntrega(tx, params.id, payload.orgId, payload.userId)
      if (!r.ok) throw Object.assign(new Error(r.error), { status: r.status })
      return r
    })
    return NextResponse.json({ data: result })
  } catch (error: any) {
    if (error?.status) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Otra entrega se confirmó al mismo tiempo — probá de nuevo.' }, { status: 409 })
    }
    console.error('[ENTREGA ENTREGAR]', error)
    return NextResponse.json({ error: 'Error al confirmar la entrega' }, { status: 500 })
  }
}
