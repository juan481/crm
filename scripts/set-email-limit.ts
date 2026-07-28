// Raises (or lowers) an org's monthly campaign-email cap. This is the only
// way to change it — it's deliberately not exposed in any org-facing screen,
// since there's no role above SUPER_ADMIN to gate a self-service control
// behind (see src/lib/email-usage.ts / src/lib/upsell.ts for context).
//
// Usage: npx tsx scripts/set-email-limit.ts <orgId|dominio|nombre> <nuevoLimite>
import { prisma } from '../src/lib/db'

async function main() {
  const [, , identifier, limitArg] = process.argv
  if (!identifier || !limitArg) {
    console.error('Uso: npx tsx scripts/set-email-limit.ts <orgId|dominio|nombre> <nuevoLimite>')
    process.exit(1)
  }

  const newLimit = Number(limitArg)
  if (!Number.isInteger(newLimit) || newLimit < 0) {
    console.error('El límite debe ser un entero >= 0')
    process.exit(1)
  }

  const db = prisma as any
  const select = { id: true, name: true, domain: true, emailMonthlyLimit: true }

  let org = await db.organization.findUnique({ where: { id: identifier }, select }).catch(() => null)

  if (!org) org = await db.organization.findFirst({ where: { domain: identifier }, select })

  if (!org) {
    const matches = await db.organization.findMany({
      where:  { name: { contains: identifier, mode: 'insensitive' } },
      select,
    })
    if (matches.length === 1) {
      org = matches[0]
    } else if (matches.length > 1) {
      console.error(`Hay ${matches.length} organizaciones que coinciden con "${identifier}":`)
      matches.forEach((m: any) => console.error(`  ${m.id}  ${m.name}  (${m.domain ?? 'sin dominio'})`))
      process.exit(1)
    }
  }

  if (!org) {
    console.error(`No se encontró ninguna organización para "${identifier}"`)
    process.exit(1)
  }

  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1
  const usage = await db.emailUsageMonthly.findUnique({
    where:  { organizationId_year_month: { organizationId: org.id, year, month } },
    select: { count: true },
  })

  console.log(`Organización: ${org.name} (${org.id})`)
  console.log(`Límite actual: ${org.emailMonthlyLimit}`)
  console.log(`Uso del mes actual (${month}/${year}): ${usage?.count ?? 0}`)

  const updated = await db.organization.update({
    where:  { id: org.id },
    data:   { emailMonthlyLimit: newLimit },
    select: { emailMonthlyLimit: true },
  })

  console.log(`Nuevo límite: ${updated.emailMonthlyLimit}`)
}

main().finally(() => prisma.$disconnect())
