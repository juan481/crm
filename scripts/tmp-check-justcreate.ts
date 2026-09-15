import { prisma } from '../src/lib/db'

async function main() {
  const ids = ['0391708b-e757-42b5-ae62-7cfd2d518662', '357ec350-d404-4b06-b9db-6f51e2ba2ad7']
  for (const id of ids) {
    const org = await (prisma as any).organization.findUnique({
      where: { id },
      include: { users: { select: { id: true, email: true, name: true, role: true, status: true, createdAt: true } } },
    })
    const clients = await (prisma as any).empresa.count({ where: { organizationId: id } })
    const deals = await (prisma as any).deal.count({ where: { organizationId: id } })
    const services = await (prisma as any).service.count({ where: { organizationId: id } })
    console.log('---', id, '---')
    console.log('name:', org.name, '| createdAt:', org.createdAt, '| domain:', org.domain, '| vertical:', org.vertical)
    console.log('users:', org.users)
    console.log('empresas:', clients, '| deals:', deals, '| services:', services)
  }
}
main().finally(() => prisma.$disconnect())
