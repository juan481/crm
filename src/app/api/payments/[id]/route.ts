import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { puedeVerFacturacion } from '@/lib/finance-access'
import { prisma } from '@/lib/db'
import { MEDIO_PAGO_VALUES } from '@/lib/medios-pago'

export const dynamic = 'force-dynamic'

interface Params { params: { id: string } }

// PATCH — corregir el medio de pago/detalle de un pago MANUAL ya cargado
// (banco, cuotas, N° de cheque, etc.). Pedido explícito de Abba: Norma tiene
// que poder arreglar un error de carga sin anular la factura y rehacerla.
// Editable en cualquier momento, sin importar el estado de la factura — no
// hay una segunda persona que valide el pago, así que no tiene sentido
// bloquear la corrección.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerFacturacion(payload.orgId, payload.role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const existing = await db.payment.findFirst({ where: { id: params.id, organizationId: payload.orgId } })
    if (!existing) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
    if (existing.provider !== 'MANUAL') {
      return NextResponse.json({ error: 'Sólo se puede editar el detalle de un pago manual' }, { status: 400 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    const { metodo, detalle } = body
    if (metodo !== undefined && metodo !== null && !MEDIO_PAGO_VALUES.includes(metodo)) {
      return NextResponse.json({ error: 'Medio de pago inválido' }, { status: 400 })
    }
    if (detalle !== undefined && detalle !== null && typeof detalle !== 'object') {
      return NextResponse.json({ error: 'Detalle inválido' }, { status: 400 })
    }

    const payment = await db.payment.update({
      where: { id: params.id },
      data: {
        ...(metodo !== undefined && { metodo }),
        ...(detalle !== undefined && { rawPayload: detalle }),
      },
      select: { id: true, metodo: true, rawPayload: true },
    })

    return NextResponse.json({ data: payment })
  } catch (error) {
    console.error('[PAYMENT PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar el pago' }, { status: 500 })
  }
}
