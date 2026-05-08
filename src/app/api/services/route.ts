import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const services = await prisma.service.findMany({
      where: { organizationId: payload.orgId },
      include: { _count: { select: { clients: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: services })
  } catch (error) {
    console.error('[SERVICES GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { name, description, price, currency, billingCycle } = await req.json()
    if (!name || price === undefined) {
      return NextResponse.json({ error: 'Nombre y precio son requeridos' }, { status: 400 })
    }

    const service = await prisma.service.create({
      data: {
        name,
        description: description || null,
        price: Number(price),
        currency: currency || 'USD',
        billingCycle: billingCycle || 'MONTHLY',
        organizationId: payload.orgId,
      },
      include: { _count: { select: { clients: true } } },
    })

    return NextResponse.json({ data: service }, { status: 201 })
  } catch (error) {
    console.error('[SERVICES POST]', error)
    return NextResponse.json({ error: 'Error al crear servicio' }, { status: 500 })
  }
}
