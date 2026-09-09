import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { puedeVerStock } from '@/lib/stock-access'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// POST /api/alertas-costo/[id] — body { accion: 'aplicar' | 'descartar' }.
//  aplicar   → Product.costo = costoNuevo (y price/precioGremio si la alerta
//              los trae), estado APLICADA.
//  descartar → estado DESCARTADA, sin tocar el producto.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerStock(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const accion = body?.accion
    if (accion !== 'aplicar' && accion !== 'descartar') {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }

    const db = prisma as any
    const alerta = await db.alertaCosto.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true, estado: true, productId: true, costoNuevo: true, precioNuevo: true },
    })
    if (!alerta) return NextResponse.json({ error: 'Alerta no encontrada' }, { status: 404 })
    if (alerta.estado !== 'PENDIENTE') {
      return NextResponse.json({ error: 'Esta alerta ya fue resuelta' }, { status: 409 })
    }

    await db.$transaction(async (tx: any) => {
      if (accion === 'aplicar') {
        const data: Record<string, unknown> = { costo: alerta.costoNuevo }
        if (alerta.precioNuevo != null) data.price = alerta.precioNuevo
        await tx.product.update({ where: { id: alerta.productId }, data })
      }
      await tx.alertaCosto.update({
        where: { id: alerta.id },
        data: {
          estado: accion === 'aplicar' ? 'APLICADA' : 'DESCARTADA',
          revisadoPorId: payload.userId,
          revisadoEn: new Date(),
        },
      })
    })

    return NextResponse.json({ data: { id: alerta.id, estado: accion === 'aplicar' ? 'APLICADA' : 'DESCARTADA' } })
  } catch (error) {
    console.error('[ALERTA-COSTO POST]', error)
    return NextResponse.json({ error: 'Error al procesar la alerta' }, { status: 500 })
  }
}
