import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { unstable_cache } from 'next/cache'

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  href: string
  severity: 'danger' | 'warning' | 'info'
}

async function fetchNotifications(orgId: string): Promise<AppNotification[]> {
  const now = new Date()

  // Promise.all (not $transaction) — reads don't need transaction overhead
  const [overdueInvoices, pendingPaymentClients, expiredClients] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        organizationId: orgId,          // direct column — no JOIN
        OR: [
          { status: 'OVERDUE' },
          { status: 'PENDING', dueDate: { lt: now } },
        ],
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 8,
    }),
    prisma.client.findMany({
      where: { organizationId: orgId, status: 'PENDING_PAYMENT' },
      select: { id: true, name: true },
      take: 5,
    }),
    prisma.client.findMany({
      where: { organizationId: orgId, status: 'EXPIRED' },
      select: { id: true, name: true },
      take: 5,
    }),
  ])

  const notifications: AppNotification[] = []

  for (const inv of overdueInvoices) {
    notifications.push({
      id: `inv-${inv.id}`,
      type: 'overdue_invoice',
      title: inv.status === 'OVERDUE' ? 'Factura vencida' : 'Factura pendiente',
      body: `${inv.client.name} — ${inv.amount.toLocaleString('es')} ${inv.currency}`,
      href: '/facturas',
      severity: 'danger',
    })
  }
  for (const c of pendingPaymentClients) {
    notifications.push({
      id: `pp-${c.id}`,
      type: 'pending_payment',
      title: 'Pago pendiente',
      body: `${c.name} tiene un pago pendiente`,
      href: `/clients/${c.id}`,
      severity: 'warning',
    })
  }
  for (const c of expiredClients) {
    notifications.push({
      id: `exp-${c.id}`,
      type: 'expired_service',
      title: 'Servicio expirado',
      body: `${c.name} — servicio expirado`,
      href: `/clients/${c.id}`,
      severity: 'warning',
    })
  }

  return notifications.slice(0, 15)
}

// Cache per-org for 60s — notifications don't need real-time precision
const getCachedNotifications = unstable_cache(
  fetchNotifications,
  ['notifications'],
  { revalidate: 60 }
)

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const data = await getCachedNotifications(payload.orgId)

    return NextResponse.json(
      { data },
      { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' } }
    )
  } catch (error) {
    console.error('[NOTIFICATIONS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
