import { prisma } from '../src/lib/db'
async function main() {
  const org = await prisma.organization.findFirst({ where: { name: 'Abba Seguridad' }, select: { id: true } })
  if (!org) throw new Error('org not found')
  const db = prisma as any
  const [contactos, tareas, tickets, deals, cotizaciones] = await Promise.all([
    db.directorioContacto.count({ where: { organizationId: org.id } }),
    db.task.count({ where: { organizationId: org.id } }),
    db.ticket.count({ where: { organizationId: org.id } }),
    db.deal.count({ where: { organizationId: org.id } }),
    db.cotizacion.count({ where: { organizationId: org.id } }),
  ])
  console.log({ contactos, tareas, tickets, deals, cotizaciones })
}
main().finally(() => prisma.$disconnect())
