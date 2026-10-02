import { prisma } from '../src/lib/db'

async function main() {
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS unaccent`)
  const installed = await prisma.$queryRawUnsafe(`SELECT extname, extversion FROM pg_extension WHERE extname = 'unaccent'`)
  console.log('OK, instalada:', installed)
  const test = await prisma.$queryRawUnsafe(`SELECT unaccent('Mónica Delia Ramos') AS sin_tilde`)
  console.log('Test:', test)
}
main().finally(() => prisma.$disconnect())
