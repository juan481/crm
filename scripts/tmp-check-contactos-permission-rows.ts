import { prisma } from '../src/lib/db'

async function main() {
  const rows = await prisma.modulePermission.findMany({
    where: { moduleId: 'contactos' },
    include: { organization: { select: { name: true } } },
  })
  console.log('Filas existentes de module-permission para "contactos" (antes de este cambio, HR/TECHNICIAN eran letra muerta por el piso SELLER):')
  for (const r of rows) console.log(`  [${r.organization.name}] ${r.role} = ${r.enabled}`)
}
main().finally(() => prisma.$disconnect())
