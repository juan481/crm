import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  mercadoPagoConfigured,
  parseMpWebhookRef,
  verifyMpWebhookSignature,
  fetchMpPaymentEvent,
  fetchMpPreapprovalStatus,
} from '@/lib/payments/mercadopago'
import { reconcileInvoicePayment, reconcileAbonoPayment } from '@/lib/payments/reconcile'

export const dynamic = 'force-dynamic'

// Webhook de Mercado Pago (cobros en ARS). Público por middleware — se
// autentica por la firma `x-signature` de MP. Fail-closed si falta
// MP_WEBHOOK_SECRET.
//
// El body del webhook NO es la fuente de verdad del estado: sólo trae el id;
// después se consulta el recurso real con GET a la API de MP.
export async function POST(req: NextRequest) {
  if (!mercadoPagoConfigured()) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  const raw = await req.text()
  let body: unknown = null
  try { body = raw ? JSON.parse(raw) : null } catch { body = null }

  const ref = parseMpWebhookRef(new URL(req.url), body)
  if (!ref) return NextResponse.json({ ok: true, ignored: true })

  const signatureOk = verifyMpWebhookSignature({
    dataId: ref.dataId,
    requestId: req.headers.get('x-request-id'),
    signatureHeader: req.headers.get('x-signature'),
  })
  if (!signatureOk) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 })
  }

  try {
    // Cambio de estado de una suscripción (autorizada / pausada / cancelada).
    if (ref.topic === 'subscription_preapproval') {
      const estado = await fetchMpPreapprovalStatus(ref.dataId)
      if (estado) {
        await prisma.servicioRecurrente.updateMany({
          where: { subProvider: 'MERCADOPAGO', subExternalId: ref.dataId },
          data: { subStatus: estado },
        })
      }
      return NextResponse.json({ ok: true, subStatus: estado })
    }

    // Pago (puntual o cuota de suscripción).
    const event = await fetchMpPaymentEvent(ref)
    if (!event) return NextResponse.json({ ok: true, ignored: true })

    const result = event.abonoId
      ? await reconcileAbonoPayment(event)
      : await reconcileInvoicePayment(event)

    if (!result.ok) {
      console.warn('[WEBHOOK MP] no conciliado:', result.reason, event.externalId)
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error('[WEBHOOK MP]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
