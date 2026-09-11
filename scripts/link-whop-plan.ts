// Vincula un plan de Whop creado A MANO desde el dashboard (no vía el CRM —
// por ejemplo para controlar la fecha exacta de renovación) con el abono
// (ServicioRecurrente) de una Empresa. A partir de ahí el webhook de Whop
// (src/app/api/webhooks/whop/route.ts) reconoce los cobros de ese plan aunque
// no tengan metadata.abonoId, buscando por subExternalId === plan_id.
//
//   npx tsx scripts/link-whop-plan.ts "REMAX PARQUE" plan_mCT5P5gw9T7Cg "https://whop.com/checkout/plan_mCT5P5gw9T7Cg/?..."
//   npx tsx scripts/link-whop-plan.ts "REMAX PARQUE" plan_mCT5P5gw9T7Cg "..." --apply
import { prisma } from '../src/lib/db'

async function main() {
  const apply = process.argv.includes('--apply')
  const args = process.argv.slice(2).filter((a) => a !== '--apply')
  const [empresaName, planId, authUrl] = args

  if (!empresaName || !planId) {
    console.error('Uso: npx tsx scripts/link-whop-plan.ts "<nombre de empresa>" <plan_id> [authUrl] [--apply]')
    process.exit(1)
  }

  const empresa = await prisma.empresa.findFirst({
    where: { name: { equals: empresaName, mode: 'insensitive' } },
    select: { id: true, name: true, organizationId: true },
  })
  if (!empresa) { console.error(`No encontré una Empresa llamada "${empresaName}"`); return }

  const abono = await prisma.servicioRecurrente.findFirst({
    where: { empresaId: empresa.id, estado: 'ACTIVO' },
    select: { id: true, nombre: true, monto: true, moneda: true, ciclo: true, diaVencimiento: true, subProvider: true, subExternalId: true, subStatus: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!abono) { console.error(`"${empresa.name}" no tiene un ServicioRecurrente ACTIVO`); return }

  // Ya hay OTRO abono usando este mismo plan_id — evita pisar un vínculo existente por error.
  const clash = await prisma.servicioRecurrente.findFirst({
    where: { subProvider: 'WHOP', subExternalId: planId, id: { not: abono.id } },
    select: { id: true, nombre: true, empresa: { select: { name: true } } },
  })
  if (clash) {
    console.error(`Ese plan_id ya está vinculado a otro abono: "${clash.nombre}" de ${clash.empresa?.name} (${clash.id})`)
    return
  }

  console.log(`Empresa:  ${empresa.name} (${empresa.id})`)
  console.log(`Abono:    ${abono.nombre} — ${abono.monto} ${abono.moneda} / ${abono.ciclo}, vence día ${abono.diaVencimiento} (${abono.id})`)
  console.log(`Vínculo actual: subProvider=${abono.subProvider ?? '(ninguno)'} subExternalId=${abono.subExternalId ?? '(ninguno)'} subStatus=${abono.subStatus ?? '(ninguno)'}`)
  console.log(`Nuevo plan_id:  ${planId}`)
  if (authUrl) console.log(`Auth URL:       ${authUrl}`)

  if (!apply) { console.log('\nDry-run. Corré con --apply para guardar.'); return }

  await prisma.servicioRecurrente.update({
    where: { id: abono.id },
    data: {
      subProvider: 'WHOP',
      subExternalId: planId,
      subAuthUrl: authUrl || null,
      subStatus: 'PENDIENTE_AUTORIZACION',
    },
  })
  console.log('\n✅ Vinculado. Cuando el cliente autorice el débito en Whop y llegue el primer cobro, el webhook va a:')
  console.log('   1. Encontrar este abono por subExternalId (aunque el plan no tenga metadata).')
  console.log('   2. Poner subStatus=ACTIVO y crear/marcar PAGADA la factura del mes.')
  console.log('   El cron mensual va a saltear este abono mientras subStatus=ACTIVO (no genera factura duplicada).')
}

main().finally(() => prisma.$disconnect())
