import { prisma } from '../src/lib/db'

async function main() {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `)
  for (const r of rows) console.log(r.table_name, '| rls_enabled=', r.rls_enabled, '| rls_forced=', r.rls_forced)
}
main().finally(() => prisma.$disconnect())
