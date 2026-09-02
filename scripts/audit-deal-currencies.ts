// Auditoría read-only de las monedas de las oportunidades (Deal.currency).
//
// El "Valor esperado" del Pipeline muestra un total por moneda, nunca
// convertido entre monedas (ver src/app/(dashboard)/pipeline/page.tsx). Si
// alguien cargó un deal a mano con monto en pesos pero sin cambiar la moneda,
// queda como un "US$ X" que en realidad son pesos y descuadra la lectura.
//
// Este script NO escribe nada — lista los deals agrupados por moneda para
// revisarlos de un vistazo y decidir cuáles corregir a mano en el CRM.
//
// Uso:
//   npx tsx scripts/audit-deal-currencies.ts
//   npx tsx scripts/audit-deal-currencies.ts --org="Abba Seguridad"
import { prisma } from '../src/lib/db'

const orgArg = process.argv.find((a) => a.startsWith('--org='))?.split('=')[1]

async function main() {
  const org = orgArg
    ? await prisma.organization.findFirst({ where: { name: orgArg }, select: { id: true, name: true } })
    : await prisma.organization.findFirst({ where: { name: 'Abba Seguridad' }, select: { id: true, name: true } })
  if (!org) {
    console.error('Organización no encontrada.')
    process.exit(1)
  }
  console.log(`\nOrganización: ${org.name}\n`)

  const deals = await prisma.deal.findMany({
    where: { organizationId: org.id, stage: { not: 'PERDIDO' } },
    select: { id: true, title: true, amount: true, currency: true, probability: true, stage: true, origen: true, createdAt: true },
    orderBy: [{ currency: 'asc' }, { amount: 'desc' }],
  })

  type Row = (typeof deals)[number]
  const byCur: Record<string, Row[]> = {}
  for (const d of deals) {
    ;(byCur[d.currency] ??= []).push(d)
  }

  for (const cur of Object.keys(byCur)) {
    const rows = byCur[cur]
    const totalRaw = rows.reduce((s: number, d: Row) => s + d.amount, 0)
    const totalWeighted = rows.reduce((s: number, d: Row) => s + d.amount * (d.probability / 100), 0)
    console.log(`── ${cur} — ${rows.length} deals — suma ${totalRaw.toLocaleString('es-AR')} — ponderado ${Math.round(totalWeighted).toLocaleString('es-AR')}`)
    // Sospechosos: montos "chicos" para USD (probablemente pesos mal cargados)
    // o montos "enormes" para USD.
    for (const d of rows) {
      const flag =
        cur === 'USD' && d.amount >= 50000 ? '  ⚠ monto alto para USD, ¿son pesos?'
        : cur === 'ARS' && d.amount > 0 && d.amount < 1000 ? '  ⚠ monto muy bajo para ARS, ¿son dólares?'
        : ''
      console.log(`   ${d.amount.toLocaleString('es-AR').padStart(14)} ${cur}  ${d.stage.padEnd(11)}  ${(d.origen ?? '-').padEnd(20)}  ${d.title.slice(0, 50)}${flag}`)
    }
    console.log('')
  }

  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
