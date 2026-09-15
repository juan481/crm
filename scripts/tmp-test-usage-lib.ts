import { prisma } from '../src/lib/db'
import { getEmailUsage, incrementEmailUsage } from '../src/lib/email-usage'

const ORG_ID = '4e5924f4-850b-407e-9853-6e22d5eaf54c' // Abba Seguridad

async function main() {
  console.log('before:', await getEmailUsage(ORG_ID))
  await incrementEmailUsage(ORG_ID, 3)
  console.log('after +3:', await getEmailUsage(ORG_ID))

  // Reset back to 0 so this test doesn't pollute real usage data
  const db = prisma as any
  const now = new Date()
  await db.emailUsageMonthly.update({
    where: { organizationId_year_month: { organizationId: ORG_ID, year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 } },
    data:  { count: 0 },
  })
  console.log('after reset:', await getEmailUsage(ORG_ID))
}
main().finally(() => prisma.$disconnect())
