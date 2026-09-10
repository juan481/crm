import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { paymentsEnabledForOrg } from '@/lib/payments/config'
import { CICLO_LABEL, type Ciclo } from '@/lib/servicios-recurrentes'

export const dynamic = 'force-dynamic'

// Vista previa del portal de un cliente, para el STAFF (ADMIN+). Devuelve lo
// mismo que ve el cliente en /portal (resumen + facturas + tickets), en un
// solo request, SÓLO lectura. Scopeado a la empresa + la org del staff.
export async function GET(_req: NextRequest, { params }: { params: { empresaId: string } }) {
  const payload = await getCurrentUser()
  if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const empresa = await prisma.empresa.findFirst({
    where: { id: params.empresaId, organizationId: payload.orgId },
    select: { id: true, name: true },
  })
  if (!empresa) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

  const scope = { organizationId: payload.orgId, empresaId: empresa.id }
  const canPayOnline = paymentsEnabledForOrg(payload.orgId)

  const [servicios, invoices, tickets, portalUsers] = await Promise.all([
    prisma.servicioRecurrente.findMany({
      where: { ...scope, estado: { in: ['ACTIVO', 'PAUSADO'] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, nombre: true, monto: true, moneda: true, ciclo: true, estado: true, incluyeMonitoreo: true },
    }),
    prisma.invoice.findMany({
      where: scope,
      orderBy: { dueDate: 'desc' },
      take: 100,
      select: { id: true, amount: true, currency: true, description: true, status: true, dueDate: true, paidAt: true, numeroInterno: true, payToken: true },
    }),
    prisma.ticket.findMany({
      where: scope,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, number: true, title: true, status: true, category: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { organizationId: payload.orgId, empresaId: empresa.id, role: 'CLIENTE', status: { not: 'DELETED' } },
      select: { email: true },
    }),
  ])

  const saldoPorMoneda: Record<string, number> = {}
  for (const inv of invoices) {
    if (inv.status === 'PENDING' || inv.status === 'OVERDUE') {
      saldoPorMoneda[inv.currency] = (saldoPorMoneda[inv.currency] ?? 0) + inv.amount
    }
  }

  return NextResponse.json({
    data: {
      empresaName: empresa.name,
      tieneAcceso: portalUsers.length > 0,
      emailsConAcceso: portalUsers.map((u) => u.email),
      servicios: servicios.map((s) => ({ ...s, cicloLabel: CICLO_LABEL[s.ciclo as Ciclo] ?? s.ciclo })),
      saldoPorMoneda,
      facturasPendientes: invoices.filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE').length,
      facturas: invoices.map((inv) => ({
        id: inv.id,
        numero: inv.numeroInterno ?? `#${inv.id.slice(-6).toUpperCase()}`,
        concepto: inv.description ?? 'Servicio',
        amount: inv.amount,
        currency: inv.currency,
        status: inv.status,
        dueDate: inv.dueDate.toISOString(),
        paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
        payToken: canPayOnline && inv.status !== 'CANCELLED' ? inv.payToken : null,
      })),
      tickets: tickets.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })),
    },
  })
}
