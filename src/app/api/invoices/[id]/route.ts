import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { getCurrentUser } from '@/lib/auth'
import { puedeVerFacturacion } from '@/lib/finance-access'
import { prisma } from '@/lib/db'
import { fireWebhook } from '@/lib/webhooks'
import { dateOnlyArgentina } from '@/lib/timezone'
import { recordManualPayment } from '@/lib/payments/reconcile'
import { sendPaymentReceiptEmail } from '@/lib/invoice-email'
import { MEDIO_PAGO_VALUES } from '@/lib/medios-pago'

interface Params { params: { id: string } }

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
      include: {
        empresa: { select: { id: true, name: true, address: true, city: true, province: true, cuit: true } },
        client: { select: { id: true, name: true } },
        items: { orderBy: { createdAt: 'asc' } },
        payments: {
          where: { provider: 'MANUAL' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, metodo: true, rawPayload: true, createdAt: true },
        },
      },
    })
    if (!inv) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })

    // Email sugerido — primer contacto de la empresa con mail.
    let recipientEmail: string | null = null
    if (inv.empresaId) {
      const c = await db.directorioContacto.findFirst({
        where: { organizationId: payload.orgId, empresaId: inv.empresaId, email: { not: null } },
        select: { email: true },
      })
      recipientEmail = c?.email ?? null
    }

    return NextResponse.json({
      data: {
        ...inv,
        dueDate: inv.dueDate.toISOString(),
        paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
        sentAt: inv.sentAt ? inv.sentAt.toISOString() : null,
        createdAt: inv.createdAt.toISOString(),
        updatedAt: inv.updatedAt.toISOString(),
        recipientEmail,
      },
    })
  } catch (error) {
    console.error('[INVOICE GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerFacturacion(payload.orgId, payload.role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    // select acotado a lo que este handler usa (paidAt/status para decidir
    // si hay que setear/limpiar paidAt) — antes traía la fila completa.
    const existing = await prisma.invoice.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { paidAt: true, status: true, amount: true, currency: true },
    })
    if (!existing) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })

    const body = await req.json()
    const { status, amount, currency, description, dueDate, metodo, detalle } = body

    const VALID_STATUSES = ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']
    if (status && !VALID_STATUSES.includes(status))
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
    if (amount !== undefined && !(Number(amount) > 0))
      return NextResponse.json({ error: 'El monto debe ser mayor a cero' }, { status: 400 })

    // Pedido de Abba: antes de marcar "Pagada" hay que gestionar/registrar el
    // pago — Facturación (Norma) tiene que elegir el medio de pago, no basta
    // un click. Sólo se exige al TRANSICIONAR a PAID (no si ya estaba PAID y
    // sólo se está tocando otro campo).
    const marcandoPagada = status === 'PAID' && existing.status !== 'PAID'
    if (marcandoPagada && (!metodo || !MEDIO_PAGO_VALUES.includes(metodo))) {
      return NextResponse.json({ error: 'Elegí el medio de pago para registrar el cobro' }, { status: 400 })
    }

    // Si cambia el monto o la moneda, la URL de checkout cacheada (Whop/MP)
    // apunta a un cobro con el valor viejo — se invalida para que se recree
    // con el nuevo la próxima vez que alguien abra el link de pago.
    const amountChanged = amount !== undefined && Number(amount) !== existing.amount
    const currencyChanged = !!currency && currency !== existing.currency
    const invalidateCheckout = amountChanged || currencyChanged

    // Pedido de Abba: el pago tiene que quedar registrado en la MISMA
    // transacción que marca la factura como pagada — antes, si
    // recordManualPayment fallaba después del update, la factura quedaba
    // "Pagada" sin ningún Payment asociado (sin rastro de cómo se cobró).
    // Ahora, si el registro del pago falla, todo el PATCH falla y el
    // cliente ve el error — no hay forma de que quede a medio camino.
    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: params.id },
        data: {
          ...(status && { status }),
          ...(status === 'PAID' && !existing.paidAt && { paidAt: new Date() }),
          ...(status === 'PENDING' && { paidAt: null }),
          ...(amount !== undefined && { amount: Number(amount) }),
          ...(currency && { currency }),
          ...(description !== undefined && { description }),
          ...(invalidateCheckout && { checkoutUrl: null, checkoutRef: null }),
          // dateOnlyArgentina, no `new Date(dueDate)` — mismo fix que en el
          // POST de creación (src/app/api/invoices/route.ts), mismo motivo.
          ...(dueDate && (() => {
            const [y, m, d] = String(dueDate).split('-').map(Number)
            return { dueDate: dateOnlyArgentina(y, m - 1, d) }
          })()),
        },
        include: {
          empresa: { select: { id: true, name: true } },
          client:  { select: { id: true, name: true } },
        },
      })

      if (marcandoPagada) {
        // Conciliación MANUAL — deja rastro de Payment (provider MANUAL) igual
        // que un cobro por pasarela, para que el detalle de la factura y los
        // reportes de cobros no tengan un "agujero" cuando se paga por
        // transferencia (Abba), efectivo, cheque o tarjeta.
        await recordManualPayment({
          invoiceId: inv.id,
          organizationId: payload.orgId,
          amount: inv.amount,
          currency: inv.currency,
          metodo,
          detalle: detalle && typeof detalle === 'object' ? detalle : null,
          client: tx,
        })
      }

      return inv
    })

    if (marcandoPagada) {
      // Comprobante al cliente — best-effort, pedido de Abba. Se dispara
      // DESPUÉS de confirmada la transacción (nunca dentro: una llamada a
      // SMTP no tiene por qué mantener abierta la conexión de la DB) y con
      // waitUntil (no fire-and-forget con sólo .catch()) porque en
      // funciones serverless de Vercel una promesa no esperada puede
      // cortarse a mitad de camino apenas se manda la respuesta — mismo
      // criterio que src/lib/task-notifications.ts y el resto de los
      // envíos best-effort del CRM.
      waitUntil(
        sendPaymentReceiptEmail({ invoiceId: invoice.id, organizationId: payload.orgId, metodo, detalle: detalle ?? null })
          .catch((err) => console.error('[INVOICE PATCH] sendPaymentReceiptEmail falló:', err)),
      )

      fireWebhook(payload.orgId, 'invoice.paid', {
        id: invoice.id, amount: invoice.amount, currency: invoice.currency,
        description: invoice.description, empresa: invoice.empresa?.name ?? null, client: invoice.client?.name ?? null,
      })
    }

    return NextResponse.json({ data: invoice })
  } catch (error) {
    console.error('[INVOICE PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar factura' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerFacturacion(payload.orgId, payload.role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    // deleteMany filtrando por id+organizationId de una — antes era un
    // findFirst de verificación de ownership seguido de un delete (2
    // round-trips secuenciales) cuando 1 alcanza: el count devuelto YA nos
    // dice si existía y era de esta organización.
    const result = await prisma.invoice.deleteMany({ where: { id: params.id, organizationId: payload.orgId } })
    if (result.count === 0) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    return NextResponse.json({ message: 'Factura eliminada' })
  } catch (error) {
    console.error('[INVOICE DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
