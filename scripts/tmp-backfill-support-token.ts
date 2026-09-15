// Backfill de Organization.publicSupportToken para las orgs que ya existían
// antes de la Fase 13 (nullable a propósito, ver comentario en el schema).
// Orgs nuevas ya lo reciben solas via @default(cuid()).
import { randomUUID } from 'crypto'
import { prisma } from '../src/lib/db'

async function main() {
  const db = prisma as any
  const orgs = await db.organization.findMany({
    where: { publicSupportToken: null },
    select: { id: true, name: true },
  })
  console.log(`${orgs.length} organización(es) sin token`)
  for (const org of orgs) {
    const token = randomUUID()
    await db.organization.update({ where: { id: org.id }, data: { publicSupportToken: token } })
    console.log(`  ${org.name}: ${token}`)
  }
}
main().finally(() => prisma.$disconnect())
