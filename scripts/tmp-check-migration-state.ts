import { prisma } from '../src/lib/db'
async function main() {
  const db = prisma as any
  const orgs = await db.organization.findMany({ select: { id: true, name: true } })
  for (const org of orgs) {
    const [clientCount, empresaCount, empresaClienteCount, invoiceCount] = await Promise.all([
      db.client.count({ where: { organizationId: org.id } }),
      db.empresa.count({ where: { organizationId: org.id } }),
      db.empresa.count({ where: { organizationId: org.id, isCliente: true } }),
      db.invoice.count({ where: { organizationId: org.id } }),
    ])
    console.log(org.name, { clientCount, empresaCount, empresaClienteCount, invoiceCount })
  }
}
main().finally(() => prisma.$disconnect())
