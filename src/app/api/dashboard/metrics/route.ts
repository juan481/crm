import { NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface MonthRow {
  n: unknown
  currency: string
  revenue: number | string
}

interface MetricsData {
  activeClients: number
  pendingPayment: number
  overdueInvoices: number
  // Montos separados por moneda — nunca se deben sumar entre sí (una
  // factura en USD y otra en ARS no son la misma unidad).
  mrrByCurrency: Record<string, number>
  mrrGrowthByCurrency: Record<string, number>
  newClientsThisMonth: number
  revenueByMonth: { month: string; byCurrency: Record<string, number> }[]
  invoicesByStatus: { status: string; count: number }[]
  pendingTasks: number
  openTickets: number
  activeDealsCount: number
  pipelineValue: number
  dealsByStage: Record<string, number>
  cotizacionesEnviadas: number
  cotizacionesAceptadas: number
  topClientsByRevenue: { id: string; name: string; total: number; currency: string }[]
}

// Metrics are computed from Empresa (the live "Clientes" model, toggled via
// isCliente) + Invoice — NOT the legacy Client model, which the active
// Clientes/Empresas workflow never populates.
async function fetchMetrics(orgId: string): Promise<MetricsData> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    activeClients,
    newClientsThisMonth,
    monthlyRows,
    pendingPayment,
    overdueInvoices,
    invoiceStatusGroups,
    topRevenueGroups,
    pendingTasks,
    openTickets,
    activeDeals,
    cotizacionGroups,
  ] = await Promise.all([
    prisma.empresa.count({ where: { organizationId: orgId, isCliente: true } }),

    prisma.empresa.count({
      where: { organizationId: orgId, isCliente: true, clienteDesde: { gte: startOfMonth } },
    }),

    // 6-month real revenue (sum of invoices actually paid that month),
    // grouped by currency — a USD invoice and an ARS invoice are not the
    // same unit and must never be summed together. Months/currencies with
    // no paid invoices simply produce no row (filled in below in JS).
    prisma.$queryRaw<MonthRow[]>`
      SELECT
        gs.n,
        i.currency AS currency,
        COALESCE(SUM(i.amount), 0)::float AS revenue
      FROM generate_series(0, 5) AS gs(n)
      JOIN "Invoice" i ON
        i."organizationId" = ${orgId}
        AND i."status" = 'PAID'
        AND i."paidAt" >= DATE_TRUNC('month', NOW()) - (gs.n * INTERVAL '1 month')
        AND i."paidAt" <  DATE_TRUNC('month', NOW()) - ((gs.n - 1) * INTERVAL '1 month')
      GROUP BY gs.n, i.currency
      ORDER BY gs.n DESC
    `,

    prisma.invoice.count({ where: { organizationId: orgId, status: 'PENDING' } }),
    prisma.invoice.count({
      where: { organizationId: orgId, OR: [{ status: 'OVERDUE' }, { status: 'PENDING', dueDate: { lt: now } }] },
    }),
    prisma.invoice.groupBy({
      by: ['status'],
      where: { organizationId: orgId },
      _count: { _all: true },
    }),
    // by empresaId AND currency — una Empresa con facturas en dos monedas
    // no puede sumarse en un único total.
    prisma.invoice.groupBy({
      by: ['empresaId', 'currency'],
      where: { organizationId: orgId, status: 'PAID', empresaId: { not: null } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    }),

    prisma.task.count({ where: { organizationId: orgId, status: { not: 'HECHA' } } }),
    prisma.ticket.count({ where: { organizationId: orgId, status: { in: ['ABIERTO', 'EN_PROCESO'] } } }),
    prisma.deal.findMany({
      where: { organizationId: orgId, stage: { notIn: ['GANADO', 'PERDIDO'] } },
      select: { amount: true, probability: true, stage: true },
    }),
    (prisma as any).cotizacion.groupBy({
      by: ['status'],
      where: { organizationId: orgId },
      _count: { _all: true },
    }),
  ])

  const byCurrencyForMonth = (n: number) => {
    const acc: Record<string, number> = {}
    monthlyRows.filter((r) => Number(r.n) === n).forEach((r) => { acc[r.currency] = Number(r.revenue) })
    return acc
  }

  const mrrByCurrency = byCurrencyForMonth(0)
  const prevMrrByCurrency = byCurrencyForMonth(1)
  const mrrGrowthByCurrency: Record<string, number> = {}
  new Set([...Object.keys(mrrByCurrency), ...Object.keys(prevMrrByCurrency)]).forEach((cur) => {
    const cur_now  = mrrByCurrency[cur] ?? 0
    const cur_prev = prevMrrByCurrency[cur] ?? 0
    mrrGrowthByCurrency[cur] = cur_prev === 0 ? (cur_now > 0 ? 100 : 0) : Math.round(((cur_now - cur_prev) / cur_prev) * 100)
  })

  const monthLabel = (n: number) =>
    new Date(now.getFullYear(), now.getMonth() - n, 1).toLocaleString('es', { month: 'short', year: '2-digit' })

  const revenueByMonth = Array.from({ length: 6 }, (_, i) => {
    const n = 5 - i
    return { month: monthLabel(n), byCurrency: byCurrencyForMonth(n) }
  })

  const invoicesByStatus = invoiceStatusGroups.map((g) => ({
    status: g.status,
    count: g._count._all,
  }))

  const empresaIds = topRevenueGroups.map((g) => g.empresaId).filter((id): id is string => !!id)
  const topEmpresas = empresaIds.length
    ? await prisma.empresa.findMany({ where: { id: { in: empresaIds } }, select: { id: true, name: true } })
    : []
  const topClientsByRevenue = topRevenueGroups
    .filter((g) => g.empresaId)
    .map((g) => ({
      id: g.empresaId as string,
      name: topEmpresas.find((e) => e.id === g.empresaId)?.name ?? '—',
      total: g._sum.amount ?? 0,
      currency: g.currency,
    }))

  const pipelineValue = activeDeals.reduce((s, d) => s + d.amount * (d.probability / 100), 0)
  const dealsByStage  = activeDeals.reduce<Record<string, number>>((acc, d) => {
    acc[d.stage] = (acc[d.stage] ?? 0) + 1
    return acc
  }, {})

  const getCotizCount = (s: string) =>
    (cotizacionGroups as Array<{ status: string; _count: { _all: number } }>)
      .find((g) => g.status === s)?._count._all ?? 0

  return {
    activeClients, pendingPayment, overdueInvoices,
    mrrByCurrency, mrrGrowthByCurrency, newClientsThisMonth,
    revenueByMonth, invoicesByStatus,
    pendingTasks, openTickets,
    activeDealsCount: activeDeals.length,
    pipelineValue, dealsByStage,
    cotizacionesEnviadas: getCotizCount('ENVIADA'),
    cotizacionesAceptadas: getCotizCount('ACEPTADA'),
    topClientsByRevenue,
  }
}

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER'))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const data = await fetchMetrics(payload.orgId)

    return NextResponse.json(
      { data },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('[DASHBOARD/METRICS]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
