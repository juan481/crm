import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { puedeVerStock } from '@/lib/stock-access'
import { cobradoPorFactura, saldoDe } from '@/lib/invoice-saldo'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// GET /api/dashboard/deposito — KPIs de depósito para el dashboard. Devuelve
// { visible: false } si el usuario no tiene acceso al módulo (el componente
// se esconde solo).
export async function GET(_req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerStock(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ data: { visible: false } })
    }

    const db = prisma as any
    const [productos, alertasPendientes, comprasAbiertas, facturasAbiertas] = await Promise.all([
      db.product.findMany({ where: { organizationId: payload.orgId, trackStock: true }, select: { stock: true, costo: true, currency: true } }),
      db.alertaCosto.count({ where: { organizationId: payload.orgId, estado: 'PENDIENTE' } }),
      db.compra.findMany({ where: { organizationId: payload.orgId, estado: 'CONFIRMADA', estadoPago: { in: ['PENDIENTE', 'PARCIAL'] } }, select: { total: true, moneda: true, pagos: { select: { monto: true } } } }),
      db.invoice.findMany({ where: { organizationId: payload.orgId, status: { in: ['PENDING', 'OVERDUE'] } }, select: { id: true, amount: true, currency: true } }),
    ])

    const valorInventario: Record<string, number> = {}
    for (const p of productos) if (p.costo && p.stock > 0) valorInventario[p.currency] = (valorInventario[p.currency] ?? 0) + p.costo * p.stock

    const porPagar: Record<string, number> = {}
    for (const c of comprasAbiertas) {
      const pagado = c.pagos.reduce((s: number, x: any) => s + x.monto, 0)
      porPagar[c.moneda] = (porPagar[c.moneda] ?? 0) + Math.max(0, c.total - pagado)
    }

    const porCobrar: Record<string, number> = {}
    // Saldo real (pagos parciales, Abba 2026-11): lo ya pagado a cuenta no se cobra de nuevo.
    const cobradoMap = await cobradoPorFactura(facturasAbiertas.map((f: any) => f.id))
    for (const f of facturasAbiertas) porCobrar[f.currency] = (porCobrar[f.currency] ?? 0) + saldoDe(f.amount, cobradoMap.get(f.id) ?? 0)

    return NextResponse.json({ data: { visible: true, valorInventario, alertasPendientes, porPagar, porCobrar } })
  } catch (error) {
    console.error('[DASHBOARD DEPOSITO]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
