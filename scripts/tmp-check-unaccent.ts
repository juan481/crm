import { prisma } from '../src/lib/db'

async function main() {
  try {
    const avail = await prisma.$queryRawUnsafe(`SELECT * FROM pg_available_extensions WHERE name = 'unaccent'`)
    console.log('Disponible:', avail)
    const installed = await prisma.$queryRawUnsafe(`SELECT extname FROM pg_extension WHERE extname = 'unaccent'`)
    console.log('Instalada:', installed)
  } catch (e) {
    console.error('Error:', e)
  }
}
main().finally(() => prisma.$disconnect())
