import { prisma } from '../src/lib/db'

async function main() {
  const org = await prisma.organization.findFirst({ where: { name: { contains: 'Abba', mode: 'insensitive' } }, select: { id: true } })
  if (!org) return
  const like = '%Monica%'
  const rows = await prisma.$queryRaw<{ id: string; firstName: string; lastName: string }[]>`
    SELECT dc.id, dc."firstName", dc."lastName" FROM "DirectorioContacto" dc
    LEFT JOIN "Empresa" e ON e.id = dc."empresaId"
    WHERE dc."organizationId" = ${org.id}
    AND (
      unaccent(dc."firstName" || ' ' || dc."lastName") ILIKE unaccent(${like})
      OR unaccent(COALESCE(dc.email, '')) ILIKE unaccent(${like})
      OR unaccent(COALESCE(dc.role, '')) ILIKE unaccent(${like})
      OR unaccent(COALESCE(dc."companyRaw", '')) ILIKE unaccent(${like})
      OR unaccent(COALESCE(e.name, '')) ILIKE unaccent(${like})
    )
  `
  console.log('Buscando "Monica" (sin tilde):', rows)
}
main().finally(() => prisma.$disconnect())
