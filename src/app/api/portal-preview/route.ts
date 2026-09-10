import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser, canAccess } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Lista todos los clientes de la org con un resumen de su portal (saldo,
// facturas pendientes, si tienen acceso). Para el panel /portal-clientes del
// staff. ADMIN+.
export async function GET() {
  const payload = await getCurrentUser()
  if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const empresas = await prisma.empresa.findMany({
    where: { organizationId: payload.orgId, isCliente: true },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true,
      invoices: { where: { status: { in: ['PENDING', 'OVERDUE'] } }, select: { amount: true, currency: true } },
      portalUsers: { where: { role: 'CLIENTE', status: { not: 'DELETED' } }, select: { id: true } },
      serviciosRecurrentes: { where: { estado: 'ACTIVO' }, select: { id: true } },
    },
  })

  return NextResponse.json({
    data: empresas.map((e) => {
      const saldo: Record<string, number> = {}
      for (const inv of e.invoices) saldo[inv.currency] = (saldo[inv.currency] ?? 0) + inv.amount
      return {
        id: e.id,
        name: e.name,
        tieneAcceso: e.portalUsers.length > 0,
        facturasPendientes: e.invoices.length,
        saldoPorMoneda: saldo,
        servicios: e.serviciosRecurrentes.length,
      }
    }),
  })
}
