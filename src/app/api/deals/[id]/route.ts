import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const existing = await prisma.deal.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
    })
    if (!existing) return NextResponse.json({ error: 'Deal no encontrado' }, { status: 404 })

    const { title, amount, currency, probability, stage, expectedCloseDate, notes, clientId, ownerId, closedAt } = await req.json()

    const deal = await prisma.deal.update({
      where: { id: params.id },
      data: {
        ...(title && { title }),
        ...(amount !== undefined && { amount: Number(amount) }),
        ...(currency && { currency }),
        ...(probability !== undefined && { probability: Number(probability) }),
        ...(stage !== undefined && { stage }),
        ...(expectedCloseDate !== undefined && { expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(clientId !== undefined && { clientId: clientId || null }),
        ...(ownerId && { ownerId }),
        ...(closedAt !== undefined && { closedAt: closedAt ? new Date(closedAt) : null }),
      },
      include: {
        client: { select: { id: true, name: true, company: true } },
        owner: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ data: deal })
  } catch (error) {
    console.error('[DEAL PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    await prisma.deal.deleteMany({ where: { id: params.id, organizationId: payload.orgId } })
    return NextResponse.json({ message: 'Deal eliminado' })
  } catch (error) {
    console.error('[DEAL DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
