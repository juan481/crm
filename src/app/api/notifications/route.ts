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

  const overdueInvoices = await prisma.invoice.findMany({
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
      empresa: { select: { id: true, name: true } },
    },
    orderBy: { dueDate: 'asc' },
    take: 8,
  })

  const notifications: AppNotification[] = []

  for (const inv of overdueInvoices) {
    notifications.push({
      id: `inv-${inv.id}`,
      type: 'overdue_invoice',
      title: inv.status === 'OVERDUE' ? 'Factura vencida' : 'Factura pendiente',
      body: `${inv.empresa?.name ?? 'Cliente'} — ${inv.amount.toLocaleString('es')} ${inv.currency}`,
      href: '/facturas',
      severity: 'danger',
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
