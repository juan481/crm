import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { puedeVerFacturacion } from '@/lib/finance-access'
import { prisma } from '@/lib/db'
import { cobradoPorFactura, saldoDe, round2 } from '@/lib/invoice-saldo'
import { medioPagoLabel } from '@/lib/medios-pago'

export const dynamic = 'force-dynamic'

// Cuenta corriente de clientes (pedido de Abba, Seba 2026-11-02). Se arma
// 100% a partir de Invoice + Payment — no hay un libro aparte que se pueda
// desincronizar:
//   DEBE  = cada factura no cancelada (por su total)
//   HABER = cada cobro aprobado (manual o por pasarela)
//   saldo = DEBE − HABER, por moneda (pesos y dólares nunca se suman)
//
// GET ?empresaId=… → movimientos de ese cliente con saldo acumulado.
// GET (sin empresaId) → clientes que hoy deben algo, con su saldo por moneda.
export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerFacturacion(payload.orgId, payload.role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }
    const orgId = payload.orgId
    const empresaId = req.nextUrl.searchParams.get('empresaId')

    if (!empresaId) {
      const pendientes = await prisma.invoice.findMany({
        where: { organizationId: orgId, empresaId: { not: null }, status: { in: ['PENDING', 'OVERDUE'] } },
        select: { id: true, amount: true, currency: true, dueDate: true, empresa: { select: { id: true, name: true } } },
      })
      const cobrado = await cobradoPorFactura(pendientes.map((i) => i.id))
      const now = Date.now()
      const porEmpresa = new Map<string, { empresaId: string; nombre: string; saldoPorMoneda: Record<string, number>; facturas: number; vencidas: number; conPagoParcial: number }>()
      for (const inv of pendientes) {
        if (!inv.empresa) continue
        const s = saldoDe(inv.amount, cobrado.get(inv.id) ?? 0)
        if (s <= 0) continue
        const row = porEmpresa.get(inv.empresa.id) ?? { empresaId: inv.empresa.id, nombre: inv.empresa.name, saldoPorMoneda: {}, facturas: 0, vencidas: 0, conPagoParcial: 0 }
        row.saldoPorMoneda[inv.currency] = round2((row.saldoPorMoneda[inv.currency] ?? 0) + s)
        row.facturas++
        if (inv.dueDate.getTime() < now) row.vencidas++
        if ((cobrado.get(inv.id) ?? 0) > 0) row.conPagoParcial++
        porEmpresa.set(inv.empresa.id, row)
      }
      const data = Array.from(porEmpresa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      return NextResponse.json({ data })
    }

    const empresa = await prisma.empresa.findFirst({ where: { id: empresaId, organizationId: orgId }, select: { id: true, name: true } })
    if (!empresa) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    const invoices = await prisma.invoice.findMany({
      where: { organizationId: orgId, empresaId, status: { not: 'CANCELLED' } },
      select: {
        id: true, amount: true, currency: true, status: true, numeroInterno: true, description: true,
        createdAt: true, dueDate: true, paidAt: true,
        payments: {
          where: { status: 'APPROVED' },
          select: { id: true, amount: true, currency: true, provider: true, metodo: true, paidAt: true, createdAt: true },
        },
      },
    })

    type Mov = {
      id: string; fecha: string; tipo: 'FACTURA' | 'PAGO'; concepto: string; invoiceId: string
      currency: string; debe: number; haber: number; saldo?: number
    }
    const movs: Mov[] = []
    for (const inv of invoices) {
      const numero = inv.numeroInterno ?? `#${inv.id.slice(-6).toUpperCase()}`
      movs.push({
        id: `f-${inv.id}`, fecha: inv.createdAt.toISOString(), tipo: 'FACTURA', invoiceId: inv.id,
        concepto: `Factura ${numero}${inv.description ? ` — ${inv.description}` : ''}`,
        currency: inv.currency, debe: inv.amount, haber: 0,
      })
      let cobrado = 0
      for (const p of inv.payments) {
        cobrado += p.amount
        const medio = p.provider === 'MANUAL' ? (medioPagoLabel(p.metodo) ?? 'Pago manual') : p.provider === 'WHOP' ? 'Whop' : 'Mercado Pago'
        movs.push({
          id: `p-${p.id}`, fecha: (p.paidAt ?? p.createdAt).toISOString(), tipo: 'PAGO', invoiceId: inv.id,
          concepto: `Pago ${medio} — factura ${numero}`,
          currency: inv.currency, debe: 0, haber: p.amount,
        })
      }
      // Factura marcada Pagada sin cobros registrados (flujo viejo, o
      // "Nueva factura" creada ya Pagada) — sin esto figuraría como deuda.
      if (inv.status === 'PAID' && inv.amount - cobrado > 0.005) {
        movs.push({
          id: `x-${inv.id}`, fecha: (inv.paidAt ?? inv.createdAt).toISOString(), tipo: 'PAGO', invoiceId: inv.id,
          concepto: `Pago registrado — factura ${numero}`,
          currency: inv.currency, debe: 0, haber: round2(inv.amount - cobrado),
        })
      }
    }

    // Orden cronológico; a igual fecha, la factura antes que su pago.
    movs.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.tipo === b.tipo ? 0 : a.tipo === 'FACTURA' ? -1 : 1))
    const acumulado: Record<string, number> = {}
    for (const m of movs) {
      acumulado[m.currency] = round2((acumulado[m.currency] ?? 0) + m.debe - m.haber)
      m.saldo = acumulado[m.currency]
    }

    return NextResponse.json({
      data: {
        empresa,
        movimientos: movs.reverse(), // más nuevo arriba
        saldoPorMoneda: acumulado,
      },
    })
  } catch (error) {
    console.error('[CUENTA CORRIENTE GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
