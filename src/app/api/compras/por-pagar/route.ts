import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { puedeVerCompras } from '@/lib/stock-access'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// GET /api/compras/por-pagar — cuentas por pagar: compras confirmadas con
// saldo, ordenadas por vencimiento, con aging (0-30 / 30-60 / 60+) y el total
// a pagar por moneda.
export async function GET(_req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const compras = await db.compra.findMany({
      where: { organizationId: payload.orgId, estado: 'CONFIRMADA', estadoPago: { in: ['PENDIENTE', 'PARCIAL'] } },
      orderBy: [{ vencimiento: 'asc' }, { fecha: 'asc' }],
      select: {
        id: true, numero: true, numeroComprobante: true, fecha: true, vencimiento: true,
        moneda: true, total: true, estadoPago: true,
        proveedor: { select: { id: true, name: true } },
        pagos: { select: { monto: true } },
      },
    })

    const now = Date.now()
    const aging: Record<string, { d0_30: number; d30_60: number; d60: number; sinVenc: number }> = {}
    const totalPorMoneda: Record<string, number> = {}

    const rows = compras.map((c: any) => {
      const pagado = c.pagos.reduce((s: number, p: any) => s + p.monto, 0)
      const saldo = Math.max(0, c.total - pagado)
      totalPorMoneda[c.moneda] = (totalPorMoneda[c.moneda] ?? 0) + saldo
      const a = (aging[c.moneda] ??= { d0_30: 0, d30_60: 0, d60: 0, sinVenc: 0 })
      if (!c.vencimiento) a.sinVenc += saldo
      else {
        const dias = Math.floor((now - new Date(c.vencimiento).getTime()) / 86_400_000)
        if (dias < 30) a.d0_30 += saldo
        else if (dias < 60) a.d30_60 += saldo
        else a.d60 += saldo
      }
      return {
        id: c.id, numero: c.numero, numeroComprobante: c.numeroComprobante,
        fecha: c.fecha.toISOString(),
        vencimiento: c.vencimiento ? c.vencimiento.toISOString() : null,
        vencido: c.vencimiento ? new Date(c.vencimiento).getTime() < now : false,
        moneda: c.moneda, total: c.total, pagado, saldo, estadoPago: c.estadoPago,
        proveedor: c.proveedor,
      }
    })

    return NextResponse.json({ data: rows, totalPorMoneda, aging })
  } catch (error) {
    console.error('[COMPRAS POR-PAGAR]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
