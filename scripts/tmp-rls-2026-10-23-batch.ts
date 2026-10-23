import { prisma } from '../src/lib/db'

// RLS en las tablas que habían quedado sin activar (2026-10-23) — mismo
// criterio que tmp-enable-rls.ts: RLS prendido SIN políticas = la clave
// pública (anon/authenticated) de Supabase no puede leer ni escribir nada
// por PostgREST. La app no se entera: todo pasa por Prisma (dueño de las
// tablas, RLS no le aplica). Ver grep de `.from(` — sólo se usa Storage.
const TABLES = [
  'CommissionLedger', 'DeletionRequest', 'HorarioTramo', 'SalesTarget',
  'SolicitudCompra', 'SolicitudCompraItem', 'Vigilador', 'VigiladorCurso', 'VigiladorTurno',
  'AjusteAbono',
]

async function main() {
  for (const t of TABLES) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "public"."${t}" ENABLE ROW LEVEL SECURITY;`)
    console.log('RLS enabled on', t)
  }
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    select c.relname as table_name from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
  `)
  console.log('Tablas que siguen sin RLS:', rows.map((r) => r.table_name))
}
main().finally(() => prisma.$disconnect())
