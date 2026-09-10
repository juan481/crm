// Pagos & Portal — rellena Invoice.payToken en las facturas que quedaron con
// NULL (todas las anteriores al push del schema). Toda factura NUEVA ya lo
// recibe sola por el @default(uuid()) del schema.
//
//   npx tsx scripts/backfill-invoice-paytoken.ts            (dry-run)
//   npx tsx scripts/backfill-invoice-paytoken.ts --apply
import crypto from 'crypto'
import { prisma } from '../src/lib/db'

async function main() {
  const apply = process.argv.includes('--apply')

  const pendientes = await prisma.invoice.findMany({
    where: { payToken: null },
    select: { id: true, organizationId: true, description: true, amount: true, currency: true },
  })

  console.log(`${pendientes.length} factura(s) sin payToken.`)
  if (pendientes.length === 0) return

  if (!apply) {
    for (const inv of pendientes.slice(0, 20)) {
      console.log(`  - ${inv.id}  ${inv.currency} ${inv.amount}  ${inv.description ?? ''}`)
    }
    if (pendientes.length > 20) console.log(`  … y ${pendientes.length - 20} más`)
    console.log('\nDry-run. Corré con --apply para escribir.')
    return
  }

  let done = 0
  for (const inv of pendientes) {
    await prisma.invoice.update({ where: { id: inv.id }, data: { payToken: crypto.randomUUID() } })
    done++
    if (done % 50 === 0) console.log(`  ${done}/${pendientes.length}`)
  }
  console.log(`Listo: ${done} facturas actualizadas.`)
}

main().finally(() => prisma.$disconnect())
