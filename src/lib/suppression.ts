import { prisma } from '@/lib/db'

const norm = (email: string) => email.trim().toLowerCase()

/** Marks an email as opted out of marketing sends for an org. Idempotent. */
export async function suppressEmail(orgId: string, email: string, reason = 'unsubscribed') {
  const db = prisma as any
  await db.emailSuppression.upsert({
    where:  { organizationId_email: { organizationId: orgId, email: norm(email) } },
    update: {},
    create: { organizationId: orgId, email: norm(email), reason },
  })
}

/** Returns the subset of emails (lowercased) that are suppressed for an org. */
export async function getSuppressedSet(orgId: string, emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set()
  const db = prisma as any
  const rows = await db.emailSuppression.findMany({
    where:  { organizationId: orgId, email: { in: emails.map(norm) } },
    select: { email: true },
  })
  return new Set(rows.map((r: { email: string }) => r.email))
}

/** Filters a recipient list down to emails not on the org's suppression list. */
export async function filterSuppressed<T extends { email: string }>(orgId: string, recipients: T[]): Promise<{ allowed: T[]; suppressed: T[] }> {
  const suppressedSet = await getSuppressedSet(orgId, recipients.map(r => r.email))
  const allowed: T[] = []
  const suppressed: T[] = []
  for (const r of recipients) {
    (suppressedSet.has(norm(r.email)) ? suppressed : allowed).push(r)
  }
  return { allowed, suppressed }
}
