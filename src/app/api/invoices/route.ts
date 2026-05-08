import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const status = searchParams.get('status') ?? ''
    const clientId = searchParams.get('clientId') ?? ''
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Number(searchParams.get('limit') ?? 20))
    const skip = (page - 1) * limit

    const baseWhere = { client: { organizationId: payload.orgId } }
    const where = {
      ...baseWhere,
      ...(status && { status }),
      ...(clientId && { clientId }),
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [data, total, pendingAgg, paidAgg, overdueCount] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDate: 'asc' },
        include: { client: { select: { id: true, name: true, email: true } } },
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.aggregate({
        where: { ...baseWhere, status: { in: ['PENDING', 'OVERDUE'] } },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: { ...baseWhere, status: 'PAID', paidAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      prisma.invoice.count({
        where: {
          ...baseWhere,
          OR: [{ status: 'OVERDUE' }, { status: 'PENDING', dueDate: { lt: now } }],
        },
      }),
    ])

    return NextResponse.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        pendingTotal: pendingAgg._sum.amount ?? 0,
        paidThisMonth: paidAgg._sum.amount ?? 0,
        overdueCount,
      },
    })
  } catch (error) {
    console.error('[INVOICES GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { clientId, amount, currency, description, dueDate, status } = await req.json()
    if (!clientId || !amount || !dueDate) {
      return NextResponse.json({ error: 'Cliente, monto y vencimiento son requeridos' }, { status: 400 })
    }

    const client = await prisma.client.findFirst({
      where: { id: clientId, organizationId: payload.orgId },
    })
    if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    const initialStatus = status || 'PENDING'
    const invoice = await prisma.invoice.create({
      data: {
        clientId,
        amount: Number(amount),
        currency: currency || 'USD',
        description: description || null,
        dueDate: new Date(dueDate),
        status: initialStatus,
        paidAt: initialStatus === 'PAID' ? new Date() : null,
      },
      include: { client: { select: { id: true, name: true, email: true } } },
    })

    return NextResponse.json({ data: invoice }, { status: 201 })
  } catch (error) {
    console.error('[INVOICES POST]', error)
    return NextResponse.json({ error: 'Error al crear factura' }, { status: 500 })
  }
}
