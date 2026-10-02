import { prisma } from '../src/lib/db'

async function main() {
  const org = await prisma.organization.findFirst({
    where: { name: { contains: 'Abba', mode: 'insensitive' } },
    select: { id: true, name: true },
  })
  if (!org) { console.log('No se encontró organización Abba'); return }

  const row = await prisma.modulePermission.upsert({
    where: { organizationId_moduleId_role: { organizationId: org.id, moduleId: 'contactos', role: 'TECHNICIAN' } },
    update: { enabled: true },
    create: { organizationId: org.id, moduleId: 'contactos', role: 'TECHNICIAN', enabled: true },
  })
  console.log('OK:', row)
}
main().finally(() => prisma.$disconnect())
