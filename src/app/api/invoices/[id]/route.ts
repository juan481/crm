import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { fireWebhook } from '@/lib/webhooks'
import { dateOnlyArgentina } from '@/lib/timezone'
import { recordManualPayment } from '@/lib/payments/reconcile'

interface Params { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const inv = await db.invoice.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      include: {
        empresa: { select: { id: true, name: true, address: true, city: true, province: true, cuit: true } },
        client: { select: { id: true, name: true } },
        items: { orderBy: { createdAt: 'asc' } },
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
    if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) {
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
    const { status, amount, currency, description, dueDate } = body

    const VALID_STATUSES = ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']
    if (status && !VALID_STATUSES.includes(status))
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
    if (amount !== undefined && !(Number(amount) > 0))
      return NextResponse.json({ error: 'El monto debe ser mayor a cero' }, { status: 400 })

    // Si cambia el monto o la moneda, la URL de checkout cacheada (Whop/MP)
    // apunta a un cobro con el valor viejo — se invalida para que se recree
    // con el nuevo la próxima vez que alguien abra el link de pago.
    const amountChanged = amount !== undefined && Number(amount) !== existing.amount
    const currencyChanged = !!currency && currency !== existing.currency
    const invalidateCheckout = amountChanged || currencyChanged

    const invoice = await prisma.invoice.update({
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

    if (status === 'PAID' && existing.status !== 'PAID') {
      // Conciliación MANUAL — deja rastro de Payment (provider MANUAL) igual
      // que un cobro por pasarela, para que el detalle de la factura y los
      // reportes de cobros no tengan un "agujero" cuando se paga por
      // transferencia (Abba) o efectivo.
      try {
        await recordManualPayment({
          invoiceId: invoice.id,
          organizationId: payload.orgId,
          amount: invoice.amount,
          currency: invoice.currency,
          note: 'Marcada como pagada manualmente desde Facturación',
        })
      } catch (err) {
        console.error('[INVOICE PATCH] recordManualPayment falló:', err)
      }

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
    if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) {
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
