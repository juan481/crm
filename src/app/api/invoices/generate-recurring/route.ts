import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Returns empresas that would be billed (preview) or creates invoices (action).
// Uses Empresa.monthlyAmount — the legacy Client.mrr this used to read from
// belongs to a model the live Clientes/Empresas workflow never populates.
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN'))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const billableEmpresas = await prisma.empresa.findMany({
      where: { organizationId: payload.orgId, isCliente: true, monthlyAmount: { gt: 0 } },
      select: { id: true, name: true, monthlyAmount: true, billingCurrency: true },
      orderBy: { name: 'asc' },
    })

    // Find which empresas already have an invoice this month
    const existingInvoices = await prisma.invoice.findMany({
      where: {
        empresaId: { in: billableEmpresas.map((e) => e.id) },
        createdAt: { gte: startOfMonth, lt: endOfMonth },
      },
      select: { empresaId: true },
    })
    const alreadyBilledIds = new Set(existingInvoices.map((i) => i.empresaId))

    const pending = billableEmpresas.filter((e) => !alreadyBilledIds.has(e.id))
    const alreadyBilled = billableEmpresas.filter((e) => alreadyBilledIds.has(e.id))

    return NextResponse.json({
      data: {
        pending,
        alreadyBilled,
        month: now.toLocaleString('es', { month: 'long', year: 'numeric' }),
      },
    })
  } catch (error) {
    console.error('[RECURRING PREVIEW]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { empresaIds } = await req.json() as { empresaIds: string[] }
    if (!empresaIds?.length) {
      return NextResponse.json({ error: 'No hay clientes seleccionados' }, { status: 400 })
    }

    const now = new Date()
    const monthName = now.toLocaleString('es', { month: 'long', year: 'numeric' })
    const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 5) // due on 5th of next month

    const empresas = await prisma.empresa.findMany({
      where: { id: { in: empresaIds }, organizationId: payload.orgId, isCliente: true },
    })

    // createMany en vez de $transaction(array de creates) — este último NO
    // paraleliza, ejecuta cada create como un INSERT secuencial (su propio
    // round-trip cada uno) sobre la misma transacción. Con N empresas
    // seleccionadas esto era N round-trips uno atrás de otro, en la acción
    // que el negocio corre activamente todos los meses. El frontend
    // (RecurringModal en facturas/page.tsx) sólo usa json.message, nunca
    // json.data — no hace falta devolver las filas creadas.
    const result = await prisma.invoice.createMany({
      data: empresas.map((e) => ({
        empresaId: e.id,
        organizationId: payload.orgId,
        amount: e.monthlyAmount ?? 0,
        currency: e.billingCurrency || 'USD',
        description: `Facturación recurrente — ${monthName}`,
        dueDate,
        status: 'PENDING' as const,
      })),
    })

    return NextResponse.json({
      data: { count: result.count },
      message: `${result.count} factura${result.count > 1 ? 's' : ''} generada${result.count > 1 ? 's' : ''} correctamente`,
    }, { status: 201 })
  } catch (error) {
    console.error('[RECURRING GENERATE]', error)
    return NextResponse.json({ error: 'Error al generar facturas' }, { status: 500 })
  }
}
