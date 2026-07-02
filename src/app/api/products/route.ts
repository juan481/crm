import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = prisma as any
    const products = await db.product.findMany({
      where:   { organizationId: payload.orgId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: products })
  } catch (error) {
    console.error('[PRODUCTS GET]', error)
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

    const { name, description, price, currency, unit } = await req.json()
    if (!name || price === undefined) {
      return NextResponse.json({ error: 'Nombre y precio son requeridos' }, { status: 400 })
    }

    const db = prisma as any
    const product = await db.product.create({
      data: {
        name,
        description: description || null,
        price:       Number(price),
        currency:    currency || 'USD',
        unit:        unit || 'unidad',
        organizationId: payload.orgId,
      },
    })

    return NextResponse.json({ data: product }, { status: 201 })
  } catch (error) {
    console.error('[PRODUCTS POST]', error)
    return NextResponse.json({ error: 'Error al crear producto' }, { status: 500 })
  }
}
