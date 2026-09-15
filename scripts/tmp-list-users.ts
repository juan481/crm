import { prisma } from '../src/lib/db'

async function main() {
  const users = await (prisma as any).user.findMany({
    select: { id: true, email: true, name: true, role: true, isPlatformAdmin: true, organization: { select: { name: true } } },
  })
  console.log(users)
}
main().finally(() => prisma.$disconnect())
