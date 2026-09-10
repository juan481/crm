import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyWhopSignature, verifyWhopWebhook, parseWhopSubStatusEvent, whopConfigured } from '@/lib/payments/whop'
import { reconcileInvoicePayment, reconcileAbonoPayment } from '@/lib/payments/reconcile'

export const dynamic = 'force-dynamic'

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
      await prisma.servicioRecurrente.updateMany({
        where: { subProvider: 'WHOP', subExternalId: { not: null }, id: subStatus.abonoId },
        data: { subStatus: subStatus.status },
      })
      return NextResponse.json({ ok: true, abonoSubStatus: subStatus.status })
    }

    // Evento de pago.
    const event = verifyWhopWebhook(raw, req.headers)
    if (!event) return NextResponse.json({ ok: true, ignored: true })

    const result = event.abonoId
      ? await reconcileAbonoPayment(event)
      : await reconcileInvoicePayment(event)

    if (!result.ok) console.warn('[WEBHOOK WHOP] no conciliado:', result.reason, event.externalId)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[WEBHOOK WHOP]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
