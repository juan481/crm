import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Returns clients that would be billed (preview) or creates invoices (action)
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const activeClients = await prisma.client.findMany({
      where: { organizationId: payload.orgId, status: 'ACTIVE', mrr: { gt: 0 } },
      select: { id: true, name: true, email: true, mrr: true, serviceType: true, service: { select: { name: true, currency: true } } },
      orderBy: { name: 'asc' },
    })

    // Find which clients already have an invoice this month
    const existingInvoices = await prisma.invoice.findMany({
      where: {
        clientId: { in: activeClients.map((c) => c.id) },
        createdAt: { gte: startOfMonth, lt: endOfMonth },
      },
      select: { clientId: true },
    })
    const alreadyBilled = new Set(existingInvoices.map((i) => i.clientId))

    const pending = activeClients.filter((c) => !alreadyBilled.has(c.id))
    const alreadyDone = activeClients.filter((c) => alreadyBilled.has(c.id))

    return NextResponse.json({
      data: {
        pending,
        alreadyBilled: alreadyDone,
        month: now.toLocaleString('es', { month: 'long', year: 'numeric' }),
      },
    })
  } catch (error) {
    console.error('[RECURRING PREVIEW]', error)
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

    const { clientIds } = await req.json() as { clientIds: string[] }
    if (!clientIds?.length) {
      return NextResponse.json({ error: 'No hay clientes seleccionados' }, { status: 400 })
    }

    const now = new Date()
    const monthName = now.toLocaleString('es', { month: 'long', year: 'numeric' })
    const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 5) // due on 5th of next month

    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds }, organizationId: payload.orgId, status: 'ACTIVE' },
      include: { service: { select: { name: true, currency: true } } },
    })

    const invoices = await prisma.$transaction(
      clients.map((c) =>
        prisma.invoice.create({
          data: {
            clientId: c.id,
            amount: c.mrr,
            currency: c.service?.currency ?? 'USD',
            description: `${c.service?.name ?? c.serviceType ?? 'Servicio'} — ${monthName}`,
            dueDate,
            status: 'PENDING',
          },
        })
      )
    )

    return NextResponse.json({
      data: invoices,
      message: `${invoices.length} factura${invoices.length > 1 ? 's' : ''} generada${invoices.length > 1 ? 's' : ''} correctamente`,
    }, { status: 201 })
  } catch (error) {
    console.error('[RECURRING GENERATE]', error)
    return NextResponse.json({ error: 'Error al generar facturas' }, { status: 500 })
  }
}
