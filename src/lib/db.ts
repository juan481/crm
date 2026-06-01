import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient
  invoiceBackfillDone: boolean
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// One-time backfill: populate Invoice.organizationId from the related Client.
// Runs once per process start when empty rows exist (idempotent, safe to re-run).
if (!globalForPrisma.invoiceBackfillDone) {
  globalForPrisma.invoiceBackfillDone = true
  prisma.$executeRaw`
    UPDATE "Invoice" i
    SET "organizationId" = c."organizationId"
    FROM "Client" c
    WHERE i."clientId" = c."id"
      AND (i."organizationId" IS NULL OR i."organizationId" = '')
  `.catch(() => {})
}
