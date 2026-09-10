import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPortalUser } from '@/lib/auth'
import { CICLO_LABEL, type Ciclo } from '@/lib/servicios-recurrentes'

export const dynamic = 'force-dynamic'

// Resumen del portal: servicios contratados + estado de cuenta de la Empresa
// del usuario. TODO scopeado a { organizationId, empresaId } que salen de
// getPortalUser() — nunca de nada que mande el cliente.
export async function GET() {
  const portal = await getPortalUser()
  if (!portal) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const scope = { organizationId: portal.orgId, empresaId: portal.empresaId }

  const [servicios, pendientes, empresa] = await Promise.all([
    prisma.servicioRecurrente.findMany({
      where: { ...scope, estado: { in: ['ACTIVO', 'PAUSADO'] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, nombre: true, monto: true, moneda: true, ciclo: true, estado: true, incluyeMonitoreo: true },
    }),
    prisma.invoice.findMany({
      where: { ...scope, status: { in: ['PENDING', 'OVERDUE'] } },
      select: { amount: true, currency: true },
    }),
    prisma.empresa.findFirst({ where: { id: portal.empresaId }, select: { name: true } }),
  ])

  const saldoPorMoneda: Record<string, number> = {}
  for (const inv of pendientes) {
    saldoPorMoneda[inv.currency] = (saldoPorMoneda[inv.currency] ?? 0) + inv.amount
  }

  return NextResponse.json({
    data: {
      empresaName: empresa?.name ?? '',
      servicios: servicios.map((s) => ({
        ...s,
        cicloLabel: CICLO_LABEL[s.ciclo as Ciclo] ?? s.ciclo,
      })),
      facturasPendientes: pendientes.length,
      saldoPorMoneda,
    },
  })
}
