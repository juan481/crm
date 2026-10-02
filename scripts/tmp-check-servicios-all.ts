import { prisma } from '../src/lib/db'

async function main() {
  const org = await prisma.organization.findFirst({
    where: { name: { contains: 'Abba', mode: 'insensitive' } },
    select: { id: true },
  })
  if (!org) return
  const rows = await prisma.servicioRecurrente.findMany({
    where: { organizationId: org.id },
    select: {
      id: true, nombre: true, monto: true, moneda: true, ciclo: true, estado: true,
      medioCobro: true, diaVencimiento: true, contratoInicio: true, contratoFin: true,
      incluyeMonitoreo: true, canalIngreso: true, createdAt: true,
      empresa: { select: { name: true, isCliente: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  console.log(`Total servicios recurrentes en Abba: ${rows.length}\n`)
  for (const r of rows) {
    const flags: string[] = []
    if (r.monto <= 0) flags.push('MONTO<=0')
    if (!r.empresa.isCliente) flags.push('EMPRESA_NO_CLIENTE')
    if (!r.moneda) flags.push('SIN_MONEDA')
    if (!r.nombre?.trim()) flags.push('SIN_NOMBRE')
    console.log(`[${r.estado}]${flags.length ? ' ⚠ ' + flags.join(',') : ''} ${r.empresa.name} — "${r.nombre}" — ${r.monto} ${r.moneda} / ${r.ciclo} — creado ${r.createdAt.toISOString().slice(0, 10)}`)
  }
}
main().finally(() => prisma.$disconnect())
