// Borra las 2 orgs "JustCreate" vacías creadas el 1/6 (0 usuarios, 0 empresas,
// 0 deals, 0 servicios — confirmado antes de correr esto) para dar lugar a
// una organización JustCreate nueva y limpia en el paso 0.5/0.6 del plan.
import { prisma } from '../src/lib/db'

const IDS = ['0391708b-e757-42b5-ae62-7cfd2d518662', '357ec350-d404-4b06-b9db-6f51e2ba2ad7']

async function main() {
  for (const id of IDS) {
    const org = await (prisma as any).organization.findUnique({
      where: { id },
      include: { _count: { select: { users: true, clients: true, deals: true, services: true } } },
    })
    if (!org) { console.log(id, 'no existe, salteo'); continue }
    const counts = org._count
    const isEmpty = Object.values(counts).every((n: any) => n === 0)
    if (!isEmpty) {
      console.log('NO borro', id, '— tiene datos:', counts)
      continue
    }
    await (prisma as any).organization.delete({ where: { id } })
    console.log('borrado:', id, org.name)
  }
}
main().finally(() => prisma.$disconnect())
