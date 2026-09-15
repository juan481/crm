import { prisma } from '../src/lib/db'
async function main() {
  const db = prisma as any
  const orgs = await db.organization.findMany({ select: { id: true, name: true, domain: true, emailMonthlyLimit: true } })
  console.log(orgs)
}
main().finally(() => prisma.$disconnect())
