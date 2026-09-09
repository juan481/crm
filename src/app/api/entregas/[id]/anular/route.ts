import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { puedeVerEntregas } from '@/lib/stock-access'
import { anularEntrega } from '@/lib/entregas'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// POST /api/entregas/[id]/anular — ENTREGADA → ANULADA (reingresa el stock) o
// BORRADOR → ANULADA (sólo libera reservas).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerEntregas(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const result = await db.$transaction(async (tx: any) => {
      const r = await anularEntrega(tx, params.id, payload.orgId, payload.userId)
      if (!r.ok) throw Object.assign(new Error(r.error), { status: r.status })
      return r
    })
    return NextResponse.json({ data: result })
  } catch (error: any) {
    if (error?.status) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('[ENTREGA ANULAR]', error)
    return NextResponse.json({ error: 'Error al anular la entrega' }, { status: 500 })
  }
}
