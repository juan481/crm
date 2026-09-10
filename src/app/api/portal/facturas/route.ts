import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPortalUser } from '@/lib/auth'
import { paymentsEnabledForOrg } from '@/lib/payments/config'

export const dynamic = 'force-dynamic'

// Facturas de la Empresa del usuario de portal. Devuelve el payToken sólo de
// las que se pueden pagar (PENDING/OVERDUE) para armar el link /pagar/<token>.
export async function GET() {
  const portal = await getPortalUser()
  if (!portal) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const canPayOnline = paymentsEnabledForOrg(portal.orgId)

  const invoices = await prisma.invoice.findMany({
    where: { organizationId: portal.orgId, empresaId: portal.empresaId },
    orderBy: { dueDate: 'desc' },
    take: 100,
    select: {
      id: true, amount: true, currency: true, description: true, status: true,
      dueDate: true, paidAt: true, numeroInterno: true, payToken: true, createdAt: true,
    },
  })

  return NextResponse.json({
    data: invoices.map((inv) => ({
      id: inv.id,
      numero: inv.numeroInterno ?? inv.id.slice(-8).toUpperCase(),
      concepto: inv.description ?? 'Servicio',
      amount: inv.amount,
      currency: inv.currency,
      status: inv.status,
      dueDate: inv.dueDate.toISOString(),
      paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
      // Sólo se expone el token si la factura es pagable Y la org cobra online.
      payToken: canPayOnline && (inv.status === 'PENDING' || inv.status === 'OVERDUE') ? inv.payToken : null,
    })),
  })
}
