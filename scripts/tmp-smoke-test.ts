import { prisma } from '../src/lib/db'

async function main() {
  const orgCount = await prisma.organization.count()
  const userCount = await prisma.user.count()
  const clientCount = await prisma.client.count()
  console.log('organizations:', orgCount, '| users:', userCount, '| clients:', clientCount)
}
main().finally(() => prisma.$disconnect())
