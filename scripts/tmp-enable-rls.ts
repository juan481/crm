import { prisma } from '../src/lib/db'

const TABLES = [
  'ActivityLog', 'Asistencia', 'CampaignRecipient', 'Client', 'Contact', 'Cotizacion',
  'Deal', 'DirectorioContacto', 'Document', 'EmailCampaign', 'EmailTemplate', 'Empresa',
  'EmpresaNota', 'Event', 'EventAttendee', 'Folder', 'Invoice', 'Note', 'Organization',
  'PluginConfig', 'Product', 'Sale', 'Service', 'Task', 'Ticket', 'TicketMessage', 'User',
]

async function main() {
  for (const t of TABLES) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "public"."${t}" ENABLE ROW LEVEL SECURITY;`)
    console.log('RLS enabled on', t)
  }

  const rows = await prisma.$queryRawUnsafe<any[]>(`
    select c.relname as table_name, c.relrowsecurity as rls_enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `)
  console.log('\nFinal state:')
  for (const r of rows) console.log(' ', r.table_name, '| rls_enabled=', r.rls_enabled)
}

main().finally(() => prisma.$disconnect())
