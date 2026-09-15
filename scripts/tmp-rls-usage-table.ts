import { prisma } from '../src/lib/db'

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "public"."EmailUsageMonthly" ENABLE ROW LEVEL SECURITY;`)
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    select c.relname as table_name, c.relrowsecurity as rls_enabled
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'EmailUsageMonthly'
  `)
  console.log(rows)
}
main().finally(() => prisma.$disconnect())
