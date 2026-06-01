import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { unstable_cache } from 'next/cache'

interface MonthRow {
  n: unknown
  month_date: Date | string
  revenue: number | string
}

interface MetricsData {
  activeClients: number
  pendingPayment: number
  expiredServices: number
  mrr: number
  mrrGrowth: number
  newClientsThisMonth: number
  revenueByMonth: { month: string; revenue: number }[]
  clientsByStatus: { status: string; count: number }[]
  pendingTasks: number
  openTickets: number
  activeDealsCount: number
  pipelineValue: number
  dealsByStage: Record<string, number>
}

async function fetchMetrics(orgId: string): Promise<MetricsData> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

  // 6 parallel queries (down from 16 original, now cached)
  const [
    statusGroups,
    newClientsThisMonth,
    monthlyRows,
    pendingTasks,
    openTickets,
    activeDeals,
  ] = await Promise.all([
    // All client status counts + MRR sums in ONE groupBy
    prisma.client.groupBy({
      by: ['status'],
      where: { organizationId: orgId },
      _count: { _all: true },
      _sum: { mrr: true },
    }),

    prisma.client.count({
      where: { organizationId: orgId, createdAt: { gte: startOfMonth } },
    }),

    // 6-month MRR in a single SQL — no per-month connection
    prisma.$queryRaw<MonthRow[]>`
      SELECT
        gs.n,
        DATE_TRUNC('month', NOW()) - (gs.n * INTERVAL '1 month') AS month_date,
        COALESCE(SUM(c.mrr), 0)::float AS revenue
      FROM generate_series(0, 5) AS gs(n)
      LEFT JOIN "Client" c ON
        c."organizationId" = ${orgId}
        AND c."status" = 'ACTIVE'
        AND c."createdAt" < DATE_TRUNC('month', NOW()) - ((gs.n - 1) * INTERVAL '1 month')
      GROUP BY gs.n
      ORDER BY gs.n DESC
    `,

    prisma.task.count({ where: { organizationId: orgId, status: { not: 'HECHA' } } }),
    prisma.ticket.count({ where: { organizationId: orgId, status: { in: ['ABIERTO', 'EN_PROCESO'] } } }),
    prisma.deal.findMany({
      where: { organizationId: orgId, stage: { notIn: ['GANADO', 'PERDIDO'] } },
      select: { amount: true, probability: true, stage: true },
    }),
  ])

  const getCount = (s: string) => statusGroups.find((g) => g.status === s)?._count._all ?? 0
  const getSum   = (s: string) => statusGroups.find((g) => g.status === s)?._sum.mrr  ?? 0

  const activeClients  = getCount('ACTIVE')
  const pendingPayment = getCount('PENDING_PAYMENT')
  const expiredServices = getCount('EXPIRED')
  const currentMrr = getSum('ACTIVE')

  const prevMrr = Number(monthlyRows.find((r) => Number(r.n) === 1)?.revenue ?? 0)
  const mrrGrowth =
    prevMrr === 0
      ? currentMrr > 0 ? 100 : 0
      : Math.round(((currentMrr - prevMrr) / prevMrr) * 100)

  const revenueByMonth = monthlyRows.map((row) => ({
    month: new Date(row.month_date).toLocaleString('es', { month: 'short', year: '2-digit' }),
    revenue: Number(row.revenue),
  }))

  const clientsByStatus = statusGroups.map((g) => ({
    status: g.status,
    count: g._count._all,
  }))

  const pipelineValue = activeDeals.reduce((s, d) => s + d.amount * (d.probability / 100), 0)
  const dealsByStage  = activeDeals.reduce<Record<string, number>>((acc, d) => {
    acc[d.stage] = (acc[d.stage] ?? 0) + 1
    return acc
  }, {})

  return {
    activeClients, pendingPayment, expiredServices,
    mrr: currentMrr, mrrGrowth, newClientsThisMonth,
    revenueByMonth, clientsByStatus,
    pendingTasks, openTickets,
    activeDealsCount: activeDeals.length,
    pipelineValue, dealsByStage,
  }
}

// Cache per-org for 60 seconds — avoids repeated round-trips to Supabase US West
const getCachedMetrics = unstable_cache(
  fetchMetrics,
  ['dashboard-metrics'],
  { revalidate: 60 }
)

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const data = await getCachedMetrics(payload.orgId)

    return NextResponse.json(
      { data },
      { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' } }
    )
  } catch (error) {
    console.error('[DASHBOARD/METRICS]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
