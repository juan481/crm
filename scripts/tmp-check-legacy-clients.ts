import { prisma } from '../src/lib/db'
async function main() {
  const clients = await prisma.client.findMany({
    where: { organization: { name: 'Abba Seguridad' } },
    select: { id: true, name: true, status: true, mrr: true },
  })
  console.log(clients)
}
main().finally(() => prisma.$disconnect())
