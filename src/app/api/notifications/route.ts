import { NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
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

  // Leads nuevos — hoy sólo entran vía NISSI (WhatsApp), preparado para
  // sumar más fuentes (Facebook Ads, formulario web, etc.) sin tocar este
  // bloque, sólo el string libre Deal.origen.
  const newLeads = await prisma.deal.findMany({
    where: {
      organizationId: orgId,
      stage: 'LEAD',
      createdAt: { gte: new Date(now.getTime() - 72 * 60 * 60 * 1000) },
    },
    select: { id: true, title: true, origen: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 8,
  })

  for (const deal of newLeads) {
    notifications.push({
      id: `lead-${deal.id}`,
      type: 'new_lead',
      title: deal.origen === 'WHATSAPP' ? 'Ingresó un nuevo cliente por WhatsApp' : 'Nuevo lead',
      body: deal.title,
      href: `/pipeline?dealId=${deal.id}`,
      severity: 'info',
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

    const all = await getCachedNotifications(payload.orgId)
    // Facturación es ADMIN+ (GET /api/invoices ya lo exige, y
    // /api/notifications/counts ya oculta este mismo conteo a otros
    // roles) — la caché es por organización, no por rol, así que el
    // filtro va acá, después de leerla, para no fragmentar la caché por
    // rol y sin arriesgar que quede alguna respuesta cacheada
    // "abierta". Antes esto llegaba a TECHNICIAN/SELLER vía la campanita
    // del header sin ningún chequeo de rol.
    const canSeeFinancials = canAccess(payload.role, 'ADMIN')
    const canSeeLeads = canAccess(payload.role, 'SELLER') // TECHNICIAN no tiene Pipeline en su whitelist de rutas
    const data = all.filter(n => {
      if (n.type === 'overdue_invoice') return canSeeFinancials
      if (n.type === 'new_lead') return canSeeLeads
      return true
    })

    return NextResponse.json(
      { data },
      { headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300' } }
    )
  } catch (error) {
    console.error('[NOTIFICATIONS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
