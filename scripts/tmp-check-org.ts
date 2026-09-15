import { prisma } from '../src/lib/db'

async function main() {
  const orgs = await (prisma as any).organization.findMany({
    select: { id: true, name: true, domain: true, emailMonthlyLimit: true },
  })
  console.log(orgs)
}
main().finally(() => prisma.$disconnect())
