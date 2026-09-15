import { prisma } from '../src/lib/db'

async function main() {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    select rolname, rolsuper, rolbypassrls
    from pg_roles
    where rolname = current_user
  `)
  console.log('current_user role info:', rows)

  const anon = await prisma.$queryRawUnsafe<any[]>(`
    select rolname, rolsuper, rolbypassrls
    from pg_roles
    where rolname in ('anon', 'authenticated', 'service_role', 'postgres')
    order by rolname
  `)
  console.log('key roles:', anon)
}
main().finally(() => prisma.$disconnect())
