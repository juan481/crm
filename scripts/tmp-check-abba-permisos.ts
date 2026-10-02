import { prisma } from '../src/lib/db'

async function main() {
  const org = await prisma.organization.findFirst({
    where: { name: { contains: 'Abba', mode: 'insensitive' } },
    select: { id: true, name: true, vertical: true },
  })
  if (!org) { console.log('No se encontró organización Abba'); return }
  console.log('ORG:', org)

  const users = await prisma.user.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true, email: true, role: true, status: true },
    orderBy: { role: 'asc' },
  })
  console.log('\nUSUARIOS:')
  for (const u of users) console.log(`  [${u.role}] ${u.name} <${u.email}> (${u.status})`)

  const perms = await prisma.modulePermission.findMany({
    where: { organizationId: org.id },
    select: { moduleId: true, role: true, enabled: true },
    orderBy: [{ moduleId: 'asc' }, { role: 'asc' }],
  })
  console.log('\nMODULE_PERMISSION rows (overrides sobre el default):')
  if (perms.length === 0) console.log('  (ninguna — toda la org usa defaultRoles tal cual modules.ts)')
  for (const p of perms) console.log(`  ${p.moduleId} / ${p.role} = ${p.enabled}`)
}
main().finally(() => prisma.$disconnect())
