import { prisma } from '../src/lib/db'
async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "TaskSubitem" ENABLE ROW LEVEL SECURITY`)
  const rows: any = await prisma.$queryRawUnsafe(
    `SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'TaskSubitem'`
  )
  console.log(rows)
}
main().finally(() => prisma.$disconnect())
