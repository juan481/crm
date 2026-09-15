import { prisma } from '../src/lib/db'
async function main() {
  const rows: any = await prisma.$queryRawUnsafe(
    `SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'TicketMessage'`
  )
  console.log(rows)
}
main().finally(() => prisma.$disconnect())
