import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAbonoSubscription, markAbonoSubscriptionCancelled } from '@/lib/payments/subscription'
import type { PayProvider } from '@/lib/payments/types'

export const dynamic = 'force-dynamic'

interface Params { params: { id: string } }

// Débito automático de un abono (Pagos & Portal, Fase 4).
// POST: crea/regenera el link de autorización (Whop plan o MP preapproval).
//       Body opcional: { provider: 'WHOP' | 'MERCADOPAGO' } para forzarlo.
// DELETE: marca la suscripción como cancelada del lado del CRM (el cron vuelve
//         a generar la factura del abono normalmente).
export async function POST(req: NextRequest, { params }: Params) {
  const payload = await getCurrentUser()
  if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const abono = await prisma.servicioRecurrente.findFirst({
    where: { id: params.id, organizationId: payload.orgId },
    select: { id: true, nombre: true, monto: true, moneda: true, ciclo: true, empresaId: true, estado: true },
  })
  if (!abono) return NextResponse.json({ error: 'Abono no encontrado' }, { status: 404 })
  if (abono.estado === 'BAJA') return NextResponse.json({ error: 'El abono está de baja' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const forced = body?.provider === 'WHOP' || body?.provider === 'MERCADOPAGO'
    ? (body.provider as PayProvider)
    : undefined

  try {
    const { authUrl, provider } = await createAbonoSubscription(abono, payload.orgId, forced)
    return NextResponse.json({ data: { authUrl, provider } })
  } catch (err) {
    console.error('[ABONO SUSCRIPCION POST]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'No se pudo generar el link' }, { status: 502 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const payload = await getCurrentUser()
  if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const abono = await prisma.servicioRecurrente.findFirst({
    where: { id: params.id, organizationId: payload.orgId },
    select: { id: true },
  })
  if (!abono) return NextResponse.json({ error: 'Abono no encontrado' }, { status: 404 })

  await markAbonoSubscriptionCancelled(abono.id)
  return NextResponse.json({ ok: true })
}
