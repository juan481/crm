import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN'))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { searchParams } = req.nextUrl
    const search    = searchParams.get('search')    ?? ''
    const status    = searchParams.get('status')    ?? ''
    const empresaId = searchParams.get('empresaId') ?? ''
    const page      = Math.max(1, Number(searchParams.get('page')  ?? 1))
    // Tope alto (no sólo 50) para permitir traer "todo lo filtrado" de una
    // — lo usa la exportación a Excel (plugin export-data), mismo criterio
    // que ya usa /api/empresas.
    const limit     = Math.min(2000, Number(searchParams.get('limit') ?? 20))
    const skip      = (page - 1) * limit

    const orgId = payload.orgId
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const baseWhere = { organizationId: orgId }

    // Build empresa filter: text search takes priority over a direct empresaId
    const empresaFilter: Record<string, unknown> = {}
    if (search.length >= 2) empresaFilter.name = { contains: search, mode: 'insensitive' }
    if (empresaId)          empresaFilter.id   = empresaId

    const where: Record<string, unknown> = {
      ...baseWhere,
      ...(status && { status }),
      ...(Object.keys(empresaFilter).length > 0 && { empresa: empresaFilter }),
    }

    const [data, total, pendingGroups, paidGroups, overdueCount] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDate: 'asc' },
        // client (legacy) is still included: recurring-billing invoices
        // (generate-recurring/route.ts) are only ever linked via clientId,
        // never empresaId — the UI must fall back to it.
        include: {
          empresa: { select: { id: true, name: true } },
          client:  { select: { id: true, name: true } },
        },
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.groupBy({
        by: ['currency'],
        where: { ...baseWhere, status: { in: ['PENDING', 'OVERDUE'] } },
        _sum: { amount: true },
      }),
      prisma.invoice.groupBy({
        by: ['currency'],
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

    const toByCurrency = (groups: { currency: string; _sum: { amount: number | null } }[]) =>
      Object.fromEntries(groups.map(g => [g.currency, g._sum.amount ?? 0]))

    return NextResponse.json(
      {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        summary: {
          pendingByCurrency: toByCurrency(pendingGroups),
          paidByCurrency:    toByCurrency(paidGroups),
          overdueCount,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
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

    const { empresaId, amount, currency, description, dueDate, status } = await req.json()
    if (!empresaId || !amount || !dueDate) {
      return NextResponse.json({ error: 'Cliente, monto y vencimiento son requeridos' }, { status: 400 })
    }
    if (!(Number(amount) > 0)) {
      return NextResponse.json({ error: 'El monto debe ser mayor a cero' }, { status: 400 })
    }

    const empresa = await prisma.empresa.findFirst({
      where: { id: empresaId, organizationId: payload.orgId },
      select: { id: true, organizationId: true },
    })
    if (!empresa) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    const initialStatus = status || 'PENDING'
    const invoice = await prisma.invoice.create({
      data: {
        empresaId,
        organizationId: empresa.organizationId, // persist directly
        amount:  Number(amount),
        currency: currency || 'USD',
        description: description || null,
        dueDate: new Date(dueDate),
        status: initialStatus,
        paidAt: initialStatus === 'PAID' ? new Date() : null,
      },
      include: { empresa: { select: { id: true, name: true } } },
    })

    return NextResponse.json({ data: invoice }, { status: 201 })
  } catch (error) {
    console.error('[INVOICES POST]', error)
    return NextResponse.json({ error: 'Error al crear factura' }, { status: 500 })
  }
}
