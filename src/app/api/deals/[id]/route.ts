import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

const INCLUDE = {
  empresa: { select: { id: true, name: true, city: true } },
  client:  { select: { id: true, name: true, company: true } },
  owner:   { select: { id: true, name: true } },
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER'))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const existing = await prisma.deal.findFirst({
      where: {
        id: params.id,
        organizationId: payload.orgId,
        ...(payload.role === 'SELLER' && { ownerId: payload.userId }),
      },
    })
    if (!existing) return NextResponse.json({ error: 'Deal no encontrado' }, { status: 404 })

    const { title, amount, currency, probability, stage, expectedCloseDate, notes, empresaId, clientId, ownerId, closedAt } = await req.json()

    let resolvedOwnerId = ownerId
    if (ownerId) {
      if (!canAccess(payload.role, 'ADMIN'))
        return NextResponse.json({ error: 'Solo admins pueden reasignar deals' }, { status: 403 })
      const ownerUser = await prisma.user.findFirst({
        where: { id: ownerId, organizationId: payload.orgId },
        select: { id: true },
      })
      if (!ownerUser) return NextResponse.json({ error: 'Usuario no encontrado en esta organización' }, { status: 400 })
      resolvedOwnerId = ownerUser.id
    }

    const db = prisma as any
    const deal = await db.deal.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined      && { title }),
        ...(amount !== undefined     && { amount: Number(amount) }),
        ...(currency                 && { currency }),
        ...(probability !== undefined && { probability: Number(probability) }),
        ...(stage !== undefined      && { stage }),
        ...(expectedCloseDate !== undefined && { expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null }),
        ...(notes !== undefined      && { notes: notes || null }),
        ...(empresaId !== undefined  && { empresaId: empresaId || null }),
        ...(clientId !== undefined   && { clientId: clientId || null }),
        ...(resolvedOwnerId          && { ownerId: resolvedOwnerId }),
        ...(closedAt !== undefined   && { closedAt: closedAt ? new Date(closedAt) : null }),
      },
      include: INCLUDE,
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
    if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    await prisma.deal.deleteMany({ where: { id: params.id, organizationId: payload.orgId } })
    return NextResponse.json({ message: 'Deal eliminado' })
  } catch (error) {
    console.error('[DEAL DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
