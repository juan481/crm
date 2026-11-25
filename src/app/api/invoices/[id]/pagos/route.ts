import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { getCurrentUser } from '@/lib/auth'
import { puedeVerFacturacion } from '@/lib/finance-access'
import { prisma } from '@/lib/db'
import { fireWebhook } from '@/lib/webhooks'
import { MEDIO_PAGO_VALUES } from '@/lib/medios-pago'
import { registrarCobro, CobroError } from '@/lib/cobros'
import { saldoDe, round2 } from '@/lib/invoice-saldo'
import { sendPaymentReceiptEmail } from '@/lib/invoice-email'
import { dateOnlyArgentina, argentinaDayKey } from '@/lib/timezone'

export const dynamic = 'force-dynamic'

interface Params { params: { id: string } }

// GET — cobros de la factura (todos, cualquier proveedor) + cobrado/saldo.
// Alimenta el modal "Pagos" de Facturación (pagos parciales, pedido de Abba).
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerFacturacion(payload.orgId, payload.role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const inv = await db.invoice.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: {
        id: true, amount: true, currency: true, status: true, numeroInterno: true, description: true,
        empresa: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        payments: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, provider: true, metodo: true, status: true, amount: true, currency: true, rawPayload: true, paidAt: true, createdAt: true },
        },
      },
    })
    if (!inv) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })

    const sumado = round2(inv.payments.filter((p: any) => p.status === 'APPROVED').reduce((s: number, p: any) => s + p.amount, 0))
    // Una factura Pagada/Cancelada no tiene saldo, aunque no tenga cobros
    // cargados (facturas marcadas pagadas antes de que existiera el registro
    // de pagos, o creadas ya Pagadas desde "Nueva factura").
    const cerrada = inv.status === 'PAID' || inv.status === 'CANCELLED'
    const cobrado = inv.status === 'PAID' ? Math.max(sumado, inv.amount) : sumado
    return NextResponse.json({
      data: {
        ...inv,
        // rawPayload de un pago de pasarela es la respuesta cruda del
        // proveedor (sólo para conciliación) — al modal sólo le sirve el
        // detalle de los MANUAL (medio, banco, foto del comprobante…).
        payments: inv.payments.map((p: any) => ({ ...p, rawPayload: p.provider === 'MANUAL' ? p.rawPayload : null })),
        cobrado,
        saldo: cerrada ? 0 : saldoDe(inv.amount, cobrado),
      },
    })
  } catch (error) {
    console.error('[INVOICE PAGOS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST — registra un cobro manual. Body: { monto?, metodo, detalle?, fecha? }
//   monto ausente/null = todo el saldo (la factura queda Pagada).
//   monto menor al saldo = pago parcial: la factura sigue pendiente y el
//   resto queda en la cuenta corriente del cliente.
//   fecha (YYYY-MM-DD, opcional) = cuándo entró la plata, si no es hoy.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerFacturacion(payload.orgId, payload.role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    const { metodo, detalle } = body
    if (!metodo || !MEDIO_PAGO_VALUES.includes(metodo)) {
      return NextResponse.json({ error: 'Elegí el medio de pago para registrar el cobro' }, { status: 400 })
    }
    if (detalle != null && typeof detalle !== 'object') {
      return NextResponse.json({ error: 'Detalle inválido' }, { status: 400 })
    }
    let monto: number | null = null
    if (body.monto !== undefined && body.monto !== null && body.monto !== '') {
      monto = Number(body.monto)
      if (!Number.isFinite(monto) || monto <= 0) {
        return NextResponse.json({ error: 'El monto a cobrar tiene que ser mayor a cero' }, { status: 400 })
      }
    }
    let fecha: Date | null = null
    // Hoy (día argentino) = se deja la hora real del registro; otro día =
    // mediodía de ese día (dateOnlyArgentina, mismo criterio que dueDate).
    if (typeof body.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.fecha) && body.fecha !== argentinaDayKey()) {
      if (body.fecha > argentinaDayKey()) {
        return NextResponse.json({ error: 'La fecha del cobro no puede ser futura' }, { status: 400 })
      }
      const [y, m, d] = body.fecha.split('-').map(Number)
      fecha = dateOnlyArgentina(y, m - 1, d)
    }

    const result = await (prisma as any).$transaction((tx: any) => registrarCobro(tx, {
      invoiceId: params.id,
      organizationId: payload.orgId,
      monto,
      metodo,
      detalle: detalle ?? null,
      fecha,
    }))

    // Comprobante al cliente — best-effort, después del commit (mismo
    // criterio que el PATCH de invoices/[id]). Lleva el monto de ESTE cobro
    // y, si fue parcial, el saldo que queda.
    waitUntil(
      sendPaymentReceiptEmail({
        invoiceId: params.id, organizationId: payload.orgId, metodo, detalle: detalle ?? null,
        montoCobro: result.monto, saldoRestante: result.saldo,
      }).catch((err) => console.error('[INVOICE PAGOS POST] sendPaymentReceiptEmail falló:', err)),
    )

    if (result.pagada) {
      const inv = await prisma.invoice.findUnique({
        where: { id: params.id },
        select: { id: true, amount: true, currency: true, description: true, empresa: { select: { name: true } }, client: { select: { name: true } } },
      })
      if (inv) {
        fireWebhook(payload.orgId, 'invoice.paid', {
          id: inv.id, amount: inv.amount, currency: inv.currency,
          description: inv.description, empresa: inv.empresa?.name ?? null, client: inv.client?.name ?? null,
        })
      }
    }

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    if (error instanceof CobroError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('[INVOICE PAGOS POST]', error)
    return NextResponse.json({ error: 'Error al registrar el cobro' }, { status: 500 })
  }
}
