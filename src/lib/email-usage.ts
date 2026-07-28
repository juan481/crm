import { prisma } from '@/lib/db'

/** UTC so the "month" boundary is stable regardless of server TZ (Vercel runs UTC). */
function currentMonthKey(d = new Date()): { year: number; month: number } {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
}

export interface EmailUsage { used: number; limit: number; remaining: number }

/** Current month's campaign-send usage vs. the org's monthly cap. Only campaign
 * sends count toward this — quote emails and empresa-contact emails don't. */
export async function getEmailUsage(orgId: string): Promise<EmailUsage> {
  const db = prisma as any
  const { year, month } = currentMonthKey()
  const [org, usage] = await Promise.all([
    db.organization.findUnique({ where: { id: orgId }, select: { emailMonthlyLimit: true } }),
    db.emailUsageMonthly.findUnique({
      where:  { organizationId_year_month: { organizationId: orgId, year, month } },
      select: { count: true },
    }),
  ])
  const limit = org?.emailMonthlyLimit ?? 9000
  const used  = usage?.count ?? 0
  return { used, limit, remaining: Math.max(0, limit - used) }
}

/** Increments this month's campaign-send usage counter. Call once per successfully-sent email. */
export async function incrementEmailUsage(orgId: string, n = 1): Promise<void> {
  if (n <= 0) return
  const db = prisma as any
  const { year, month } = currentMonthKey()
  await db.emailUsageMonthly.upsert({
    where:  { organizationId_year_month: { organizationId: orgId, year, month } },
    update: { count: { increment: n } },
    create: { organizationId: orgId, year, month, count: n },
  })
}
