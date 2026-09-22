// Fix del alerta crítico de Supabase "rls_disabled_in_public": 10 tablas sin
// RLS quedaban accesibles vía la API REST pública de Supabase (anon key) sin
// pasar por la auth de la app — Payment, Compra*, InvoiceItem, etc. Prisma
// conecta como el rol `postgres` (BYPASSRLS=true, confirmado antes de correr
// esto), así que activar RLS no afecta en nada a la app — sólo cierra el
// acceso público. Ya corrido contra producción — mismo patrón que
// tmp-rls-new-table.ts / tmp-rls-taskcomment.ts.
import { prisma } from '../src/lib/db'

const TABLES = [
  'AlertaCosto', 'Compra', 'CompraItem', 'CompraPago', 'EntregaStock',
  'EntregaStockItem', 'InvoiceItem', 'NotificationSetting', 'Payment', 'ServicioRecurrente',
]

async function main() {
  for (const t of TABLES) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "public"."${t}" ENABLE ROW LEVEL SECURITY;`)
    console.log('RLS enabled:', t)
  }
  const remaining = await prisma.$queryRaw`
    SELECT c.relname AS table_name FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false
  `
  console.log('Tablas sin RLS restantes (debería ser []):', remaining)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
