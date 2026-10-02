import { prisma } from '../src/lib/db'

async function main() {
  const rows = await prisma.servicioRecurrente.findMany({
    where: { monto: { lte: 0 } },
    select: {
      id: true, nombre: true, monto: true, estado: true, createdAt: true,
      empresa: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  console.log(`Servicios recurrentes con monto <= 0: ${rows.length}`)
  for (const r of rows) {
    console.log(`  [${r.estado}] ${r.empresa.name} — "${r.nombre}" — monto=${r.monto} — creado ${r.createdAt.toISOString().slice(0, 10)} (id ${r.id})`)
  }
}
main().finally(() => prisma.$disconnect())
