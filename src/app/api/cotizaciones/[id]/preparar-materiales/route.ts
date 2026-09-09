import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import { prisma } from '@/lib/db'
import { prepararEntregaDesdeCotizacion } from '@/lib/entregas'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// POST /api/cotizaciones/[id]/preparar-materiales — desde una cotización
// ACEPTADA, crea la EntregaStock BORRADOR con el material (KITs expandidos) y
// reserva el stock. Lo dispara el vendedor desde el detalle de la cotización.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role as Role, 'SELLER') && !(await roleHasModule(payload.orgId, payload.role as Role, 'cotizaciones'))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    // Un SELLER sólo prepara material de sus propias cotizaciones (mismo
    // criterio que el GET de cotizaciones/[id]).
    const cot = await db.cotizacion.findFirst({
      where: { id: params.id, organizationId: payload.orgId, ...(payload.role === 'SELLER' && { userId: payload.userId }) },
      select: { id: true },
    })
    if (!cot) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })

    const result = await db.$transaction((tx: any) => prepararEntregaDesdeCotizacion(tx, params.id, payload.orgId, payload.userId))
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    console.error('[PREPARAR MATERIALES]', error)
    return NextResponse.json({ error: 'Error al preparar el material' }, { status: 500 })
  }
}
