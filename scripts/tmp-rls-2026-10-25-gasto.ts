import { prisma } from '../src/lib/db'

// RLS en la tabla nueva Gasto (2026-10-25) — correr DESPUÉS de
// `npx prisma db push`. Mismo criterio que tmp-rls-2026-10-23-batch.ts.
async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "public"."Gasto" ENABLE ROW LEVEL SECURITY;`)
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    select c.relname as table_name from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
  `)
  console.log('Tablas que siguen sin RLS:', rows.map((r) => r.table_name))
}
main().finally(() => prisma.$disconnect())
