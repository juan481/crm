import { prisma } from '../src/lib/db'
import { MODULE_DEFINITIONS, ROLES } from '../src/lib/modules'
import type { Role } from '../src/types'

async function main() {
  const org = await prisma.organization.findFirst({
    where: { name: { contains: 'Abba', mode: 'insensitive' } },
    select: { id: true, name: true, domain: true, suspended: true },
  })
  if (!org) { console.log('No se encontró organización Abba'); return }
  console.log('ORG:', org)

  const rows = await prisma.modulePermission.findMany({ where: { organizationId: org.id } })

  console.log('\nResuelto para TECHNICIAN (lo mismo que calcula /api/module-permissions):')
  for (const def of MODULE_DEFINITIONS) {
    const row = rows.find((r) => r.moduleId === def.id && r.role === 'TECHNICIAN')
    const enabled = row ? row.enabled : def.defaultRoles.includes('TECHNICIAN' as Role)
    if (def.id === 'cotizaciones' || def.id === 'pipeline' || def.id === 'cotizador' || def.id === 'clientes' || def.id === 'empresas' || def.id === 'contactos') {
      console.log(`  ${def.id}: ${enabled} (minRole=${def.minRole}, row=${row ? row.enabled : 'ninguna, usa default'})`)
    }
  }
}
main().finally(() => prisma.$disconnect())
