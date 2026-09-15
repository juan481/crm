import { prisma } from '../src/lib/db'

async function main() {
  const org = await prisma.organization.findFirst({ where: { name: 'Abba Seguridad' }, select: { id: true } })
  if (!org) throw new Error('org not found')

  const orgId = org.id
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const monthlyRows = await prisma.$queryRaw`
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
  `
  console.log('monthlyRows:', monthlyRows)

  const activeClients = await prisma.empresa.count({ where: { organizationId: orgId, isCliente: true } })
  console.log('activeClients:', activeClients)

  const newClientsThisMonth = await prisma.empresa.count({
    where: { organizationId: orgId, isCliente: true, clienteDesde: { gte: startOfMonth } },
  })
  console.log('newClientsThisMonth:', newClientsThisMonth)

  const topRevenueGroups = await prisma.invoice.groupBy({
    by: ['empresaId'],
    where: { organizationId: orgId, status: 'PAID', empresaId: { not: null } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: 5,
  })
  console.log('topRevenueGroups:', topRevenueGroups)

  const invoiceStatusGroups = await prisma.invoice.groupBy({
    by: ['status'],
    where: { organizationId: orgId },
    _count: { _all: true },
  })
  console.log('invoiceStatusGroups:', invoiceStatusGroups)
}

main().catch((e) => { console.error('ERROR:', e); process.exit(1) }).finally(() => prisma.$disconnect())
