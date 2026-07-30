import { NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface MonthRow {
  n: unknown
  month_date: Date | string
  revenue: number | string
}

interface MetricsData {
  activeClients: number
  pendingPayment: number
  overdueInvoices: number
  mrr: number
  mrrGrowth: number
  newClientsThisMonth: number
  revenueByMonth: { month: string; revenue: number }[]
  invoicesByStatus: { status: string; count: number }[]
  pendingTasks: number
  openTickets: number
  activeDealsCount: number
  pipelineValue: number
  dealsByStage: Record<string, number>
  cotizacionesEnviadas: number
  cotizacionesAceptadas: number
  topClientsByRevenue: { id: string; name: string; total: number }[]
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

    // 6-month real revenue (sum of invoices actually paid that month)
    prisma.$queryRaw<MonthRow[]>`
      SELECT
        gs.n,
        DATE_TRUNC('month', NOW()) - (gs.n * INTERVAL '1 month') AS month_date,
        COALESCE(SUM(i.amount), 0)::float AS revenue
      FROM generate_series(0, 5) AS gs(n)
      LEFT JOIN "Invoice" i ON
        i."organizationId" = ${orgId}
        AND i."status" = 'PAID'
        AND i."paidAt" >= DATE_TRUNC('month', NOW()) - (gs.n * INTERVAL '1 month')
        AND i."paidAt" <  DATE_TRUNC('month', NOW()) - ((gs.n - 1) * INTERVAL '1 month')
      GROUP BY gs.n
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
    prisma.invoice.groupBy({
      by: ['empresaId'],
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

  const currentMrr = Number(monthlyRows.find((r) => Number(r.n) === 0)?.revenue ?? 0)
  const prevMrr = Number(monthlyRows.find((r) => Number(r.n) === 1)?.revenue ?? 0)
  const mrrGrowth =
    prevMrr === 0
      ? currentMrr > 0 ? 100 : 0
      : Math.round(((currentMrr - prevMrr) / prevMrr) * 100)

  const revenueByMonth = monthlyRows.map((row) => ({
    month: new Date(row.month_date).toLocaleString('es', { month: 'short', year: '2-digit' }),
    revenue: Number(row.revenue),
  }))

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
    mrr: currentMrr, mrrGrowth, newClientsThisMonth,
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
