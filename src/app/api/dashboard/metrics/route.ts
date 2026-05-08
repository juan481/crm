import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const orgId = payload.orgId

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

    const [
      activeClients,
      pendingPayment,
      expiredServices,
      allClients,
      newClientsThisMonth,
      lastMonthMrr,
      pendingTasks,
      openTickets,
      activeDeals,
    ] = await Promise.all([
      prisma.client.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
      prisma.client.count({ where: { organizationId: orgId, status: 'PENDING_PAYMENT' } }),
      prisma.client.count({ where: { organizationId: orgId, status: 'EXPIRED' } }),
      prisma.client.findMany({
        where: { organizationId: orgId },
        select: { mrr: true, status: true, createdAt: true },
      }),
      prisma.client.count({
        where: { organizationId: orgId, createdAt: { gte: startOfMonth } },
      }),
      prisma.client.aggregate({
        where: {
          organizationId: orgId,
          status: 'ACTIVE',
          createdAt: { lte: endOfLastMonth },
        },
        _sum: { mrr: true },
      }),
      prisma.task.count({ where: { organizationId: orgId, status: { not: 'HECHA' } } }),
      prisma.ticket.count({ where: { organizationId: orgId, status: { in: ['ABIERTO', 'EN_PROCESO'] } } }),
      prisma.deal.findMany({
        where: { organizationId: orgId, stage: { notIn: ['GANADO', 'PERDIDO'] } },
        select: { amount: true, probability: true, stage: true },
      }),
    ])

    const currentMrr = allClients
      .filter((c) => c.status === 'ACTIVE')
      .reduce((sum, c) => sum + c.mrr, 0)

    const prevMrr = lastMonthMrr._sum.mrr ?? 0
    const mrrGrowth =
      prevMrr === 0
        ? currentMrr > 0 ? 100 : 0
        : Math.round(((currentMrr - prevMrr) / prevMrr) * 100)

    // Revenue by last 6 months
    const revenueByMonth = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const monthStr = d.toLocaleString('es', { month: 'short', year: '2-digit' })
      const monthClients = allClients.filter((c) => {
        const created = new Date(c.createdAt)
        return created <= new Date(d.getFullYear(), d.getMonth() + 1, 0)
      })
      const revenue = monthClients
        .filter((c) => c.status === 'ACTIVE')
        .reduce((sum, c) => sum + c.mrr, 0)
      return { month: monthStr, revenue }
    })

    // Client distribution by status
    const statusCounts = allClients.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1
      return acc
    }, {})
    const clientsByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }))

    const pipelineValue = activeDeals.reduce((sum, d) => sum + d.amount * (d.probability / 100), 0)

    const dealsByStage = activeDeals.reduce<Record<string, number>>((acc, d) => {
      acc[d.stage] = (acc[d.stage] ?? 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      data: {
        activeClients,
        pendingPayment,
        expiredServices,
        mrr: currentMrr,
        mrrGrowth,
        newClientsThisMonth,
        revenueByMonth,
        clientsByStatus,
        pendingTasks,
        openTickets,
        activeDealsCount: activeDeals.length,
        pipelineValue,
        dealsByStage,
      },
    })
  } catch (error) {
    console.error('[DASHBOARD/METRICS]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
