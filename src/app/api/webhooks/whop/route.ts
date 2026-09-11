import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyWhopSignature, verifyWhopWebhook, parseWhopSubStatusEvent, whopConfigured } from '@/lib/payments/whop'
import { reconcileInvoicePayment, reconcileAbonoPayment } from '@/lib/payments/reconcile'

export const dynamic = 'force-dynamic'

// Resuelve el abono a partir del plan_id de Whop cuando el evento no trae
// metadata.abonoId — plan creado a mano desde el dashboard de Whop (ej.
// para fijar la fecha de renovación) y vinculado después vía
// ServicioRecurrente.subExternalId (ver scripts/link-whop-plan.ts).
async function resolveAbonoIdByPlanId(planId: string | undefined): Promise<string | null> {
  if (!planId) return null
  const abono = await prisma.servicioRecurrente.findFirst({
    where: { subProvider: 'WHOP', subExternalId: planId },
    select: { id: true },
  })
  return abono?.id ?? null
}

// Webhook de Whop (cobros en USD). Público por middleware (prefijo
// /api/webhooks) — se autentica SOLO por la firma HMAC del propio Whop.
// Fail-closed: si falta WHOP_WEBHOOK_SECRET, se rechaza todo.
//
// IMPORTANTE: se lee el body como texto CRUDO antes de parsear — el HMAC se
// calcula sobre esos bytes exactos.
export async function POST(req: NextRequest) {
  if (!whopConfigured()) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  const raw = await req.text()

  const envelope = verifyWhopSignature(raw, req.headers)
  if (!envelope) {
    // Firma inválida o timestamp viejo.
    return NextResponse.json({ ok: true, ignored: true })
  }

  try {
    // Cambio de estado de la suscripción de un abono (débito automático).
    const subStatus = parseWhopSubStatusEvent(envelope)
    if (subStatus) {
      const abonoId = subStatus.abonoId ?? await resolveAbonoIdByPlanId(subStatus.planId)
      if (!abonoId) return NextResponse.json({ ok: true, ignored: true, reason: 'plan sin abono vinculado' })
      await prisma.servicioRecurrente.updateMany({
        where: { id: abonoId, subProvider: 'WHOP' },
        data: { subStatus: subStatus.status },
      })
      return NextResponse.json({ ok: true, abonoSubStatus: subStatus.status })
    }

    // Evento de pago.
    const event = verifyWhopWebhook(raw, req.headers)
    if (!event) return NextResponse.json({ ok: true, ignored: true })

    // Sin metadata.abonoId (plan creado a mano en el dashboard de Whop, no
    // por el CRM) — se resuelve por el plan_id vinculado en el abono.
    if (!event.abonoId && !event.invoiceId && event.planId) {
      const abonoId = await resolveAbonoIdByPlanId(event.planId)
      if (abonoId) event.abonoId = abonoId
    }

    const result = event.abonoId
      ? await reconcileAbonoPayment(event)
      : event.invoiceId
        ? await reconcileInvoicePayment(event)
        : { ok: false, reason: 'evento sin invoiceId/abonoId/plan vinculado' }

    if (!result.ok) console.warn('[WEBHOOK WHOP] no conciliado:', result.reason, event.externalId)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[WEBHOOK WHOP]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
