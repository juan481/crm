import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { puedeVerCompras } from '@/lib/stock-access'
import { saldoCompra, diaDe, hoyAR, sumarDias } from '@/lib/compras-pagos'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// GET /api/compras/por-pagar — lo que falta pagarle a proveedores, en dos partes:
//  - `facturas`: compras confirmadas con saldo sin cubrir (ningún pago/cheque
//    cargado por ese monto todavía), ordenadas por vencimiento.
//  - `aDebitar`: cheques diferidos / pagos programados (CompraPago con fecha
//    de hoy en adelante). La deuda con el proveedor ya está cubierta, pero la
//    plata sale de la cuenta en esa fecha — Seba (Abba, 2026-11-24) cargaba
//    los cheques y "Por pagar" quedaba vacío.
// Totales por moneda: sinPagar, vencido, aDebitar, prox30 (lo que sale en los
// próximos 30 días: cheques + facturas que vencen en ese plazo o ya vencidas).
export async function GET(_req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const hoy = hoyAR()
    const en30 = sumarDias(hoy, 30)
    // Medianoche UTC del día de hoy: incluye pagos viejos guardados a las
    // 00:00Z y los nuevos al mediodía UTC.
    const desde = new Date(`${hoy}T00:00:00Z`)

    const db = prisma as any
    const compras = await db.compra.findMany({
      where: {
        organizationId: payload.orgId,
        estado: 'CONFIRMADA',
        OR: [
          { estadoPago: { in: ['PENDIENTE', 'PARCIAL'] } },
          { pagos: { some: { fecha: { gte: desde } } } },
        ],
      },
      orderBy: [{ vencimiento: 'asc' }, { fecha: 'asc' }],
      select: {
        id: true, numero: true, numeroComprobante: true, tipoComprobante: true, fecha: true, vencimiento: true,
        moneda: true, total: true, estadoPago: true,
        proveedor: { select: { id: true, name: true } },
        pagos: { select: { id: true, monto: true, fecha: true, medio: true, nota: true } },
      },
    })

    type Tot = Record<string, number>
    const add = (t: Tot, k: string, v: number) => { if (v > 0) t[k] = Math.round(((t[k] ?? 0) + v) * 100) / 100 }
    const sinPagar: Tot = {}, vencido: Tot = {}, aDebitarTot: Tot = {}, prox30: Tot = {}

    const facturas: any[] = []
    const aDebitar: any[] = []

    for (const c of compras) {
      const pagado = c.pagos.reduce((s: number, p: any) => s + p.monto, 0)
      const saldo = saldoCompra(c.total, pagado, c.moneda)
      const comprobante = [c.tipoComprobante?.replace('_', ' '), c.numeroComprobante].filter(Boolean).join(' ') || (c.numero ? `Compra #${c.numero}` : '')

      for (const p of c.pagos) {
        const dia = diaDe(p.fecha)
        if (dia < hoy) continue
        add(aDebitarTot, c.moneda, p.monto)
        if (dia <= en30) add(prox30, c.moneda, p.monto)
        aDebitar.push({
          id: p.id, compraId: c.id, fecha: p.fecha.toISOString(), dia, monto: p.monto, medio: p.medio, nota: p.nota,
          moneda: c.moneda, proveedor: c.proveedor, comprobante,
        })
      }

      if (saldo > 0) {
        const vDia = c.vencimiento ? diaDe(c.vencimiento) : null
        const esVencido = !!vDia && vDia < hoy
        add(sinPagar, c.moneda, saldo)
        if (esVencido) add(vencido, c.moneda, saldo)
        if (vDia && vDia <= en30) add(prox30, c.moneda, saldo)
        facturas.push({
          id: c.id, numero: c.numero, numeroComprobante: c.numeroComprobante, comprobante,
          fecha: c.fecha.toISOString(),
          vencimiento: c.vencimiento ? c.vencimiento.toISOString() : null,
          vencido: esVencido,
          moneda: c.moneda, total: c.total, pagado, saldo,
          estadoPago: pagado > 0 ? 'PARCIAL' : 'PENDIENTE',
          proveedor: c.proveedor,
        })
      }
    }

    aDebitar.sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0))

    return NextResponse.json({
      data: facturas,
      aDebitar,
      totales: { sinPagar, vencido, aDebitar: aDebitarTot, prox30 },
      hoy,
    })
  } catch (error) {
    console.error('[COMPRAS POR-PAGAR]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
