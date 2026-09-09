import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { puedeVerCompras } from '@/lib/stock-access'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

function estadoPagoPara(total: number, pagado: number): 'PENDIENTE' | 'PARCIAL' | 'PAGADA' {
  if (pagado <= 0) return 'PENDIENTE'
  if (pagado + 0.01 >= total) return 'PAGADA'
  return 'PARCIAL'
}

// POST /api/compras/[id]/pagos — registra un pago (parcial o total) a una
// compra y recalcula estadoPago. Body: { monto, fecha?, medio?, nota? }.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const monto = Number(body?.monto)
    if (!Number.isFinite(monto) || monto <= 0) {
      return NextResponse.json({ error: 'El monto del pago debe ser mayor a 0' }, { status: 400 })
    }

    const db = prisma as any
    const compra = await db.compra.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true, total: true, estado: true, pagos: { select: { monto: true } } },
    })
    if (!compra) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    if (compra.estado === 'ANULADA') return NextResponse.json({ error: 'La compra está anulada' }, { status: 409 })

    const result = await db.$transaction(async (tx: any) => {
      const pago = await tx.compraPago.create({
        data: {
          compraId: compra.id,
          monto,
          fecha: body?.fecha && !isNaN(Date.parse(body.fecha)) ? new Date(body.fecha) : new Date(),
          medio: body?.medio?.trim() || null,
          nota: body?.nota?.trim() || null,
          creadoPorId: payload.userId,
        },
      })
      const pagadoAntes = compra.pagos.reduce((s: number, p: any) => s + p.monto, 0)
      const pagado = pagadoAntes + monto
      await tx.compra.update({ where: { id: compra.id }, data: { estadoPago: estadoPagoPara(compra.total, pagado) } })
      return { pago, pagado, saldo: Math.max(0, compra.total - pagado) }
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    console.error('[COMPRA PAGOS POST]', error)
    return NextResponse.json({ error: 'Error al registrar el pago' }, { status: 500 })
  }
}

// DELETE /api/compras/[id]/pagos?pagoId=xxx — borra un pago y recalcula.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }
    const pagoId = req.nextUrl.searchParams.get('pagoId')
    if (!pagoId) return NextResponse.json({ error: 'Falta el pago a eliminar' }, { status: 400 })

    const db = prisma as any
    const compra = await db.compra.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true, total: true, pagos: { select: { id: true, monto: true } } },
    })
    if (!compra) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    if (!compra.pagos.some((p: any) => p.id === pagoId)) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
    }

    await db.$transaction(async (tx: any) => {
      await tx.compraPago.delete({ where: { id: pagoId } })
      const pagado = compra.pagos.filter((p: any) => p.id !== pagoId).reduce((s: number, p: any) => s + p.monto, 0)
      await tx.compra.update({ where: { id: compra.id }, data: { estadoPago: estadoPagoPara(compra.total, pagado) } })
    })

    return NextResponse.json({ message: 'Pago eliminado' })
  } catch (error) {
    console.error('[COMPRA PAGOS DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar el pago' }, { status: 500 })
  }
}
