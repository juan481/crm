import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const client = await prisma.client.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
    })
    if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    const { sellerId, serviceId, amount, currency = 'USD', closedAt, notes } = await req.json()

    if (!sellerId || !amount) {
      return NextResponse.json({ error: 'sellerId y amount son requeridos' }, { status: 400 })
    }

    const sale = await prisma.sale.create({
      data: {
        clientId: params.id,
        sellerId,
        serviceId: serviceId || null,
        amount: Number(amount),
        currency,
        closedAt: closedAt ? new Date(closedAt) : new Date(),
        notes: notes || null,
      },
      include: {
        seller: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, currency: true } },
      },
    })

    await prisma.client.update({
      where: { id: params.id },
      data: { assignedSellerId: sellerId },
    })

    await prisma.activityLog.create({
      data: {
        clientId: params.id,
        userId: payload.userId,
        action: 'SALE_REGISTERED',
        description: `Venta registrada por ${sale.seller.name} — $${amount} ${currency}`,
      },
    })

    return NextResponse.json({ data: sale }, { status: 201 })
  } catch (error) {
    console.error('[SALES POST]', error)
    return NextResponse.json({ error: 'Error al registrar venta' }, { status: 500 })
  }
}
