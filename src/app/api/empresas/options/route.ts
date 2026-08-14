import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Versión liviana de GET /api/empresas para los ~9 pickers que sólo
// necesitan id/name/city/cantidad-de-contactos (selects de empresa en
// Cotizador, Pipeline, Mi Día, Tickets, Contactos, campañas, merge de
// duplicados, facturas) — antes todos abusaban de `?limit=2000` contra el
// endpoint completo, pagando el SELECT grande y el mismo techo de 2000
// filas para lo que en realidad es sólo un <select>. Mismo piso de auth que
// el endpoint completo (abierto a cualquier sesión — TECHNICIAN también lo
// necesita para su picker en Tickets/Mi Día).
export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const isCliente = searchParams.get('isCliente')

    const db = prisma as any
    const where: Record<string, unknown> = { organizationId: payload.orgId }
    if (isCliente === 'true')  where.isCliente = true
    if (isCliente === 'false') where.isCliente = false

    const data = await db.empresa.findMany({
      where,
      orderBy: { name: 'asc' },
      // activity/city acá porque el picker de Comunicaciones filtra por
      // ambos campos client-side — el resto de los consumidores los ignora.
      select: { id: true, name: true, city: true, activity: true, _count: { select: { contactos: true } } },
    })

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[EMPRESAS OPTIONS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
