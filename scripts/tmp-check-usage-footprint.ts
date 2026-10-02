import { prisma } from '../src/lib/db'

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true, suspended: true } })
  console.log(`Organizaciones: ${orgs.length}`)
  for (const o of orgs) {
    const activeUsers = await prisma.user.count({ where: { organizationId: o.id, status: 'ACTIVE' } })
    console.log(`  [${o.suspended ? 'SUSPENDIDA' : 'activa'}] ${o.name}: ${activeUsers} usuarios activos`)
  }
  const totalActive = await prisma.user.count({ where: { status: 'ACTIVE' } })
  console.log(`\nTotal usuarios ACTIVE en toda la base: ${totalActive}`)

  // Catálogo — tamaño real que procesa catalogo-sync
  const totalProducts = await prisma.product.count()
  console.log(`Total productos en toda la base: ${totalProducts}`)
}
main().finally(() => prisma.$disconnect())
