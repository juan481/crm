// Pagos & Portal — Fase 0: carga las 4 empresas cliente de Just Create con su
// abono (ServicioRecurrente) y activa el plugin invoice-automation para esa
// organización.
//
// EDITÁ el array CLIENTES de abajo con los datos reales (monto, moneda, día de
// vencimiento, email de facturación, CUIT). Después:
//
//   npx tsx scripts/seed-justcreate-billing.ts            (dry-run — muestra qué haría)
//   npx tsx scripts/seed-justcreate-billing.ts --apply
//
// Es idempotente: si la empresa o el abono ya existen (match por nombre), los
// actualiza en vez de duplicar.
import { prisma } from '../src/lib/db'

// Nombre de la organización de Just Create en el CRM (confirmado que existe).
const ORG_NAME_CANDIDATES = ['Just Create', 'JustCreate']

interface ClienteSeed {
  empresa: string
  moneda: 'USD' | 'ARS'
  cuit?: string
  condicionIva?: string          // ver src/lib/fiscal.ts
  contactoEmail: string          // se usa para el link de pago y los avisos
  contactoNombre: string
  abonoNombre: string
  montoMensual: number
  ciclo?: 'MENSUAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL'
  diaVencimiento?: number        // 1–28
}

// ⚠️ COMPLETAR con los datos reales antes de correr con --apply.
const CLIENTES: ClienteSeed[] = [
  { empresa: 'REMAX PARQUE',        moneda: 'USD', contactoEmail: 'TODO@remaxparque.com',  contactoNombre: 'TODO', abonoNombre: 'Servicio mensual', montoMensual: 0 },
  { empresa: 'CIRCULO AGRONOMOS',   moneda: 'ARS', contactoEmail: 'TODO@circuloagronomos.com', contactoNombre: 'TODO', abonoNombre: 'Servicio mensual', montoMensual: 0 },
  { empresa: 'ABBA',               moneda: 'USD', contactoEmail: 'TODO@abbaseguridad.com.ar', contactoNombre: 'TODO', abonoNombre: 'Servicio mensual', montoMensual: 0 },
  { empresa: 'VETERINARIA CAPICUA', moneda: 'USD', contactoEmail: 'TODO@capicua.com', contactoNombre: 'TODO', abonoNombre: 'Servicio mensual', montoMensual: 0 },
]

async function main() {
  const apply = process.argv.includes('--apply')
  const db = prisma as any

  const org = await db.organization.findFirst({
    where: { name: { in: ORG_NAME_CANDIDATES } },
    select: { id: true, name: true },
  })
  if (!org) { console.error('No encontré la organización de Just Create. Nombres probados:', ORG_NAME_CANDIDATES); return }
  console.log(`Organización: ${org.name} (${org.id})\n`)

  for (const c of CLIENTES) {
    console.log(`— ${c.empresa} —`)
    if (c.contactoEmail.startsWith('TODO') || c.montoMensual <= 0) {
      console.log('  ⚠️  faltan datos (email/monto). Editá el script.')
      if (apply) continue
    }

    let empresa = await db.empresa.findFirst({ where: { organizationId: org.id, name: c.empresa }, select: { id: true } })

    if (!apply) {
      console.log(`  ${empresa ? 'actualizaría' : 'crearía'} la empresa (isCliente=true, billingCurrency=${c.moneda})`)
      console.log(`  ${empresa ? 'actualizaría' : 'crearía'} abono "${c.abonoNombre}" ${c.moneda} ${c.montoMensual}/${c.ciclo ?? 'MENSUAL'} venc. día ${c.diaVencimiento ?? 10}`)
      console.log(`  contacto de facturación: ${c.contactoNombre} <${c.contactoEmail}>`)
      continue
    }

    if (!empresa) {
      empresa = await db.empresa.create({
        data: {
          organizationId: org.id, name: c.empresa, isCliente: true, clienteDesde: new Date(),
          billingCurrency: c.moneda, cuit: c.cuit ?? null, condicionIva: c.condicionIva ?? null,
        },
        select: { id: true },
      })
      console.log('  empresa creada')
    } else {
      await db.empresa.update({ where: { id: empresa.id }, data: { isCliente: true, billingCurrency: c.moneda } })
      console.log('  empresa actualizada')
    }

    // Contacto de facturación
    const contactoExiste = await db.directorioContacto.findFirst({
      where: { organizationId: org.id, empresaId: empresa.id, email: c.contactoEmail },
      select: { id: true },
    })
    if (!contactoExiste) {
      const [firstName, ...rest] = c.contactoNombre.split(' ')
      await db.directorioContacto.create({
        data: {
          organizationId: org.id, empresaId: empresa.id,
          firstName: firstName || c.contactoNombre, lastName: rest.join(' ') || '-',
          email: c.contactoEmail,
        },
      })
      console.log('  contacto de facturación creado')
    }

    // Abono
    const abonoExiste = await db.servicioRecurrente.findFirst({
      where: { organizationId: org.id, empresaId: empresa.id, nombre: c.abonoNombre },
      select: { id: true },
    })
    const abonoData = {
      monto: c.montoMensual, moneda: c.moneda, ciclo: c.ciclo ?? 'MENSUAL',
      diaVencimiento: c.diaVencimiento ?? 10, estado: 'ACTIVO' as const,
    }
    if (!abonoExiste) {
      await db.servicioRecurrente.create({
        data: { organizationId: org.id, empresaId: empresa.id, nombre: c.abonoNombre, ...abonoData },
      })
      console.log('  abono creado')
    } else {
      await db.servicioRecurrente.update({ where: { id: abonoExiste.id }, data: abonoData })
      console.log('  abono actualizado')
    }
  }

  // Plugin invoice-automation + recordatorios de pago (opt-in por org).
  const pluginConfig = JSON.stringify({ remindersEnabled: 'true', reminderDays: '3,7' })
  if (apply) {
    await db.pluginConfig.upsert({
      where: { pluginId_organizationId: { pluginId: 'invoice-automation', organizationId: org.id } },
      update: { enabled: true, config: pluginConfig },
      create: { pluginId: 'invoice-automation', organizationId: org.id, enabled: true, config: pluginConfig },
    })
    console.log('\nPlugin invoice-automation + recordatorios activados para', org.name)
  } else {
    console.log('\n(activaría el plugin invoice-automation + recordatorios de pago)')
  }

  console.log(apply ? '\n✅ Listo.' : '\nDry-run. Corré con --apply.')
}

main().finally(() => prisma.$disconnect())
