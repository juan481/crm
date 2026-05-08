import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  href: string
  severity: 'danger' | 'warning' | 'info'
}

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const now = new Date()

    const [overdueInvoices, pendingPastDue, pendingPaymentClients, expiredClients] = await Promise.all([
      prisma.invoice.findMany({
        where: { client: { organizationId: payload.orgId }, status: 'OVERDUE' },
        include: { client: { select: { id: true, name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
      prisma.invoice.findMany({
        where: {
          client: { organizationId: payload.orgId },
          status: 'PENDING',
          dueDate: { lt: now },
        },
        include: { client: { select: { id: true, name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
      prisma.client.findMany({
        where: { organizationId: payload.orgId, status: 'PENDING_PAYMENT' },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      prisma.client.findMany({
        where: { organizationId: payload.orgId, status: 'EXPIRED' },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
    ])

    const notifications: AppNotification[] = []

    const seenInvoices = new Set<string>()
    for (const inv of [...overdueInvoices, ...pendingPastDue]) {
      if (seenInvoices.has(inv.id)) continue
      seenInvoices.add(inv.id)
      notifications.push({
        id: `inv-${inv.id}`,
        type: 'overdue_invoice',
        title: 'Factura vencida',
        body: `${inv.client.name} — $${inv.amount.toLocaleString('es')} ${inv.currency}`,
        href: '/invoices',
        severity: 'danger',
      })
    }

    for (const client of pendingPaymentClients) {
      notifications.push({
        id: `pp-${client.id}`,
        type: 'pending_payment',
        title: 'Pago pendiente',
        body: `${client.name} tiene un pago pendiente`,
        href: `/clients/${client.id}`,
        severity: 'warning',
      })
    }

    for (const client of expiredClients) {
      notifications.push({
        id: `exp-${client.id}`,
        type: 'expired_service',
        title: 'Servicio expirado',
        body: `${client.name} — servicio expirado`,
        href: `/clients/${client.id}`,
        severity: 'warning',
      })
    }

    return NextResponse.json({ data: notifications.slice(0, 15) })
  } catch (error) {
    console.error('[NOTIFICATIONS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
