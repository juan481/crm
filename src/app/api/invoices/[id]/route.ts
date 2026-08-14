import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { fireWebhook } from '@/lib/webhooks'
import { dateOnlyArgentina } from '@/lib/timezone'

interface Params { params: { id: string } }

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
      select: { paidAt: true, status: true },
    })
    if (!existing) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })

    const body = await req.json()
    const { status, amount, currency, description, dueDate } = body

    const VALID_STATUSES = ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']
    if (status && !VALID_STATUSES.includes(status))
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
    if (amount !== undefined && !(Number(amount) > 0))
      return NextResponse.json({ error: 'El monto debe ser mayor a cero' }, { status: 400 })

    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        ...(status && { status }),
        ...(status === 'PAID' && !existing.paidAt && { paidAt: new Date() }),
        ...(status === 'PENDING' && { paidAt: null }),
        ...(amount !== undefined && { amount: Number(amount) }),
        ...(currency && { currency }),
        ...(description !== undefined && { description }),
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
