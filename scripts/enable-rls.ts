import { prisma } from '../src/lib/db'

// Habilita Row Level Security en TODA tabla del schema `public` que no la
// tenga. `prisma db push` crea las tablas nuevas SIN RLS, así que esto hay
// que correrlo después de cada push que agregue tablas (el linter de
// Supabase lo marca como "RLS Disabled in Public").
//
// Por qué es seguro: la app se conecta con el rol `postgres` de Supabase, que
// tiene BYPASSRLS — Prisma sigue viendo todo. RLS sin políticas = sólo los
// roles con BYPASSRLS entran; corta el acceso de los roles anon/authenticated
// que Supabase expone por PostgREST sobre `public` (que esta app no usa para
// estas tablas). El aislamiento multi-tenant real lo hace la app por
// `organizationId`, esto es defensa en profundidad.
//
// Idempotente: ENABLE ROW LEVEL SECURITY sobre una tabla que ya lo tiene no
// hace nada. Se puede correr las veces que haga falta.
//   npx tsx scripts/enable-rls.ts
async function main() {
  const pending = await prisma.$queryRawUnsafe<{ table_name: string }[]>(`
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = false
      AND c.relname NOT LIKE '\\_prisma\\_%'
    ORDER BY c.relname
  `)

  if (pending.length === 0) {
    console.log('OK - todas las tablas de `public` ya tienen RLS habilitado.')
    return
  }

  console.log(`Tablas sin RLS (${pending.length}):`, pending.map((r) => r.table_name).join(', '))
  for (const { table_name } of pending) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "public"."${table_name}" ENABLE ROW LEVEL SECURITY;`)
    console.log('  - RLS habilitado en', table_name)
  }

  const still = await prisma.$queryRawUnsafe<{ table_name: string }[]>(`
    SELECT c.relname AS table_name
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false
      AND c.relname NOT LIKE '\\_prisma\\_%'
  `)
  console.log(still.length === 0 ? '\nOK - no queda ninguna.' : `\nATENCION - todavia quedan: ${still.map((r) => r.table_name).join(', ')}`)
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
