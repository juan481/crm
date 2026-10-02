import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { puedeVerCompras } from '@/lib/stock-access'
import { prisma } from '@/lib/db'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const existing = await db.solicitudCompra.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true, estado: true },
    })
    if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    if (existing.estado === 'ANULADA') return NextResponse.json({ error: 'Ya está anulada' }, { status: 409 })

    await db.solicitudCompra.update({ where: { id: params.id }, data: { estado: 'ANULADA' } })
    return NextResponse.json({ message: 'Pedido anulado' })
  } catch (error) {
    console.error('[SOLICITUD COMPRA ANULAR]', error)
    return NextResponse.json({ error: 'Error al anular' }, { status: 500 })
  }
}
