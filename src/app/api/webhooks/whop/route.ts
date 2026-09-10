import { NextRequest, NextResponse } from 'next/server'
import { verifyWhopWebhook, whopConfigured } from '@/lib/payments/whop'
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

  const event = verifyWhopWebhook(raw, req.headers)
  if (!event) {
    // Firma inválida, timestamp viejo, o evento que no movemos.
    return NextResponse.json({ ok: true, ignored: true })
  }

  try {
    const result = event.abonoId
      ? await reconcileAbonoPayment(event)
      : await reconcileInvoicePayment(event)

    if (!result.ok) {
      console.warn('[WEBHOOK WHOP] no conciliado:', result.reason, event.externalId)
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error('[WEBHOOK WHOP]', err)
    // 500 → Whop reintenta; la conciliación es idempotente.
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
