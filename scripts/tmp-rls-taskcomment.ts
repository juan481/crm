import { prisma } from '../src/lib/db'
async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "TaskComment" ENABLE ROW LEVEL SECURITY`)
  const rows: any = await prisma.$queryRawUnsafe(
    `SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'TaskComment'`
  )
  console.log(rows)
}
main().finally(() => prisma.$disconnect())
