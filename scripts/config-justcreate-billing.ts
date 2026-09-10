// Configura la Facturación Automática de la org Just Create:
//  - autoSend:         manda la factura al cliente sola el día 1
//  - dueSameMonth:     vence el día `diaVencimiento` del abono, ESTE mes
//  - remindersEnabled: recordatorios de pago a los N días del vencimiento
//  - reminderDays:     3,7
//
//   npx tsx scripts/config-justcreate-billing.ts            (muestra)
//   npx tsx scripts/config-justcreate-billing.ts --apply
import { prisma } from '../src/lib/db'

const CONFIG = {
  autoSend: 'true',
  dueSameMonth: 'true',
  remindersEnabled: 'true',
  reminderDays: '3,7',
}

async function main() {
  const apply = process.argv.includes('--apply')
  const db = prisma as any

  const org = await db.organization.findFirst({ where: { name: 'Just Create' }, select: { id: true, name: true } })
  if (!org) { console.error('No encontré la org "Just Create"'); return }

  const current = await db.pluginConfig.findUnique({
    where: { pluginId_organizationId: { pluginId: 'invoice-automation', organizationId: org.id } },
    select: { enabled: true, config: true },
  })
  console.log(`Org: ${org.name} (${org.id})`)
  console.log('Config actual:', current?.config ?? '(ninguna)')
  console.log('Config nueva: ', JSON.stringify(CONFIG))

  if (!apply) { console.log('\nDry-run. Corré con --apply.'); return }

  await db.pluginConfig.upsert({
    where: { pluginId_organizationId: { pluginId: 'invoice-automation', organizationId: org.id } },
    update: { enabled: true, config: JSON.stringify(CONFIG) },
    create: { pluginId: 'invoice-automation', organizationId: org.id, enabled: true, config: JSON.stringify(CONFIG) },
  })
  console.log('\n✅ Listo. El 1° de cada mes: genera las facturas de los abonos, las manda solas al cliente, vencen el día del abono de ESE mes, y recordatorios a los 3 y 7 días.')
}

main().finally(() => prisma.$disconnect())
