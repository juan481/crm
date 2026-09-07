// Migración one-off (OPCIONAL): convierte el campo plano Empresa.monthlyAmount
// en un ServicioRecurrente ("abono") por empresa.
//
// NO es obligatorio: el cron de facturación y el botón manual siguen
// facturando el monthlyAmount de las empresas que NO tienen abono. Este script
// sólo "prolija": deja todo bajo el mismo modelo (Servicios) para poder verlo
// centralizado, ponerle ciclo/contrato, etc.
//
// Idempotente: si una empresa ya tiene un abono con nombre "Abono mensual
// (migrado)" no crea otro. No toca el monthlyAmount (queda como estaba; el
// sistema lo ignora en cuanto la empresa tiene un abono vigente).
//
// Uso:
//   npx tsx scripts/migrate-monthly-to-abono.ts                    # DRY RUN
//   npx tsx scripts/migrate-monthly-to-abono.ts --apply            # escribe
//   npx tsx scripts/migrate-monthly-to-abono.ts --apply --org="Abba Seguridad"

import { prisma } from '../src/lib/db'

const NOMBRE_ABONO = 'Abono mensual (migrado)'

async function main() {
  const apply = process.argv.includes('--apply')
  const orgArg = process.argv.find((a) => a.startsWith('--org='))?.slice(6)

  const orgs = await prisma.organization.findMany({
    where: orgArg ? { OR: [{ name: orgArg }, { crmName: orgArg }] } : undefined,
    select: { id: true, name: true, crmName: true },
  })
  if (orgs.length === 0) {
    console.log('No se encontró ninguna organización', orgArg ? `con nombre "${orgArg}"` : '')
    return
  }

  let creados = 0
  let saltados = 0

  for (const org of orgs) {
    const empresas = await prisma.empresa.findMany({
      where: { organizationId: org.id, isCliente: true, monthlyAmount: { gt: 0 } },
      select: { id: true, name: true, monthlyAmount: true, billingCurrency: true },
    })

    for (const e of empresas) {
      const yaTiene = await prisma.servicioRecurrente.findFirst({
        where: { empresaId: e.id, nombre: NOMBRE_ABONO },
        select: { id: true },
      })
      if (yaTiene) { saltados++; continue }

      console.log(
        `${apply ? '✓' : '·'} ${org.name || org.crmName} / ${e.name} — ` +
        `${e.billingCurrency || 'USD'} ${e.monthlyAmount} /mes`,
      )

      if (apply) {
        await prisma.servicioRecurrente.create({
          data: {
            organizationId: org.id,
            empresaId: e.id,
            nombre: NOMBRE_ABONO,
            monto: e.monthlyAmount ?? 0,
            moneda: e.billingCurrency || 'USD',
            ciclo: 'MENSUAL',
            estado: 'ACTIVO',
            canalIngreso: 'CRM',
          },
        })
      }
      creados++
    }
  }

  console.log('')
  console.log(`${apply ? 'Creados' : 'Se crearían'}: ${creados} abono(s). Ya existían: ${saltados}.`)
  if (!apply) console.log('DRY RUN — volvé a correr con --apply para escribir.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
