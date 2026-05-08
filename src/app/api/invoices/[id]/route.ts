import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const existing = await prisma.invoice.findFirst({
      where: { id: params.id, client: { organizationId: payload.orgId } },
    })
    if (!existing) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })

    const body = await req.json()
    const { status, amount, currency, description, dueDate } = body

    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        ...(status && { status }),
        ...(status === 'PAID' && !existing.paidAt && { paidAt: new Date() }),
        ...(status === 'PENDING' && { paidAt: null }),
        ...(amount !== undefined && { amount: Number(amount) }),
        ...(currency && { currency }),
        ...(description !== undefined && { description }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
      },
      include: { client: { select: { id: true, name: true, email: true } } },
    })

    return NextResponse.json({ data: invoice })
  } catch (error) {
    console.error('[INVOICE PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar factura' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    await prisma.invoice.deleteMany({
      where: { id: params.id, client: { organizationId: payload.orgId } },
    })

    return NextResponse.json({ message: 'Factura eliminada' })
  } catch (error) {
    console.error('[INVOICE DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
