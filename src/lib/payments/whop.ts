import crypto from 'crypto'
import type { CheckoutResult, NormalizedPaymentEvent, NormalizedStatus } from './types'
import { WEBHOOK_MAX_SKEW_MS } from './types'

// ─── Whop (cobros en USD) ─────────────────────────────────────────────────
// API REST v2. Auth: `Authorization: Bearer <WHOP_API_KEY>`. Todo por `fetch`
// (mismo criterio que el resto del proyecto: Brevo, Graph API de WhatsApp,
// etc. — sin SDK). Whop deposita a la cuenta bancaria de Just Create; la
// conversión a USDT la hace Juan por fuera, para eso guardamos rawPayload.
//
// ⚠️ Los nombres exactos de campos de la API de Whop pueden variar según la
// versión de la cuenta. Verificar en sandbox contra la cuenta real de Just
// Create antes de ir a producción (ver crm/docs/PAGOS-Y-PORTAL.md). Los
// puntos frágiles están marcados con VERIFICAR.

const WHOP_API = 'https://api.whop.com/api/v2'
const WHOP_CHECKOUT_BASE = 'https://whop.com'

interface WhopEnv {
  apiKey: string
  productId: string
  webhookSecret: string
}

function whopEnv(): WhopEnv | null {
  const apiKey = process.env.WHOP_API_KEY
  const productId = process.env.WHOP_PRODUCT_ID
  const webhookSecret = process.env.WHOP_WEBHOOK_SECRET
  if (!apiKey || !productId || !webhookSecret) return null
  return { apiKey, productId, webhookSecret }
}

export function whopConfigured(): boolean {
  return whopEnv() !== null
}

async function whopFetch<T>(env: WhopEnv, path: string, body: unknown): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const res = await fetch(`${WHOP_API}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await res.text()
    if (!res.ok) {
      throw new Error(`Whop ${path} → ${res.status}: ${text.slice(0, 500)}`)
    }
    return JSON.parse(text) as T
  } finally {
    clearTimeout(timeout)
  }
}

// Whop pide la moneda en minúsculas ISO ("usd"). Guardamos "USD" en la
// factura; acá se traduce.
function whopCurrency(currency: string): string {
  return currency.trim().toLowerCase()
}

interface WhopPlan { id: string }
interface WhopCheckoutSession { id: string; purchase_url: string }

/**
 * Crea un plan one-time con el monto exacto de la factura + una checkout
 * session para pagarlo. Devuelve la URL hosteada.
 *
 * El monto SIEMPRE sale de `amount`/`currency` que le pasa el caller
 * (resueltos server-side desde Invoice.amount) — nunca de nada que venga del
 * navegador del cliente.
 */
export async function createWhopInvoiceCheckout(opts: {
  amount: number
  currency: string
  concepto: string
  invoiceId: string
  payToken: string
  redirectUrl: string
}): Promise<CheckoutResult> {
  const env = whopEnv()
  if (!env) throw new Error('Whop no está configurado (WHOP_API_KEY / WHOP_PRODUCT_ID / WHOP_WEBHOOK_SECRET)')

  // VERIFICAR: shape de POST /plans. Campos documentados: plan_type,
  // initial_price, base_currency, product_id, visibility, metadata.
  const plan = await whopFetch<WhopPlan>(env, '/plans', {
    plan_type: 'one_time',
    initial_price: Number(opts.amount.toFixed(2)),
    base_currency: whopCurrency(opts.currency),
    product_id: env.productId,
    visibility: 'hidden',
    internal_notes: opts.concepto.slice(0, 200),
    metadata: { kind: 'invoice', invoiceId: opts.invoiceId, payToken: opts.payToken },
  })

  // VERIFICAR: POST /checkout_sessions → { id, purchase_url }. purchase_url
  // suele venir relativo ("/checkout/plan_xxx?session=ch_xxx").
  const session = await whopFetch<WhopCheckoutSession>(env, '/checkout_sessions', {
    plan_id: plan.id,
    redirect_url: opts.redirectUrl,
    metadata: { kind: 'invoice', invoiceId: opts.invoiceId, payToken: opts.payToken },
  })

  return { url: absoluteCheckoutUrl(session.purchase_url), ref: session.id }
}

/**
 * Crea un plan RENOVABLE (débito automático mensual) para un abono + la
 * checkout session de autorización. `externalId` = el id del plan, que es lo
 * que después matchea el webhook recurrente vía metadata.abonoId.
 */
export async function createWhopAbonoSubscription(opts: {
  amount: number
  currency: string
  concepto: string
  abonoId: string
  billingPeriodDays: number
  redirectUrl: string
}): Promise<{ authUrl: string; externalId: string }> {
  const env = whopEnv()
  if (!env) throw new Error('Whop no está configurado')

  const plan = await whopFetch<WhopPlan>(env, '/plans', {
    plan_type: 'renewal',
    renewal_price: Number(opts.amount.toFixed(2)),
    initial_price: Number(opts.amount.toFixed(2)),
    base_currency: whopCurrency(opts.currency),
    billing_period: opts.billingPeriodDays,
    product_id: env.productId,
    visibility: 'hidden',
    internal_notes: opts.concepto.slice(0, 200),
    metadata: { kind: 'abono', abonoId: opts.abonoId },
  })

  const session = await whopFetch<WhopCheckoutSession>(env, '/checkout_sessions', {
    plan_id: plan.id,
    redirect_url: opts.redirectUrl,
    metadata: { kind: 'abono', abonoId: opts.abonoId },
  })

  return { authUrl: absoluteCheckoutUrl(session.purchase_url), externalId: plan.id }
}

function absoluteCheckoutUrl(purchaseUrl: string): string {
  if (/^https?:\/\//i.test(purchaseUrl)) return purchaseUrl
  return `${WHOP_CHECKOUT_BASE}${purchaseUrl.startsWith('/') ? '' : '/'}${purchaseUrl}`
}

// ─── Verificación del webhook ─────────────────────────────────────────────
// Whop firma `{webhook-id}.{webhook-timestamp}.{raw body}` con HMAC-SHA256 y
// manda el resultado base64 en `webhook-signature` (puede traer varias,
// separadas por espacio, cada una como "v1,<sig>"). El secreto `ws_...` se
// usa TAL CUAL como clave (no se le saca el prefijo ni se decodifica base64).

interface WhopEventEnvelope {
  type?: string
  action?: string
  data?: Record<string, unknown>
}

/**
 * Verifica la firma y normaliza el evento. Devuelve null si:
 *  - falta el secreto (fail-closed) o headers de firma
 *  - la firma no valida
 *  - el timestamp está fuera de la ventana de tolerancia
 *  - el evento no es un pago que nos interese
 */
export function verifyWhopWebhook(rawBody: string, headers: Headers): NormalizedPaymentEvent | null {
  const env = whopEnv()
  if (!env) return null

  const id = headers.get('webhook-id')
  const ts = headers.get('webhook-timestamp')
  const sigHeader = headers.get('webhook-signature')
  if (!id || !ts || !sigHeader) return null

  const tsMs = Number(ts) * 1000
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > WEBHOOK_MAX_SKEW_MS) return null

  const signedContent = `${id}.${ts}.${rawBody}`
  const expected = crypto.createHmac('sha256', env.webhookSecret).update(signedContent).digest('base64')

  const candidates = sigHeader
    .split(' ')
    .map((part) => (part.includes(',') ? part.slice(part.indexOf(',') + 1) : part))
    .filter(Boolean)

  const ok = candidates.some((cand) => {
    try {
      const a = Buffer.from(cand, 'base64')
      const b = Buffer.from(expected, 'base64')
      return a.length === b.length && crypto.timingSafeEqual(a, b)
    } catch {
      return false
    }
  })
  if (!ok) return null

  let evt: WhopEventEnvelope
  try {
    evt = JSON.parse(rawBody) as WhopEventEnvelope
  } catch {
    return null
  }

  return normalizeWhopEvent(evt)
}

function normalizeWhopEvent(evt: WhopEventEnvelope): NormalizedPaymentEvent | null {
  const type = (evt.type || evt.action || '').toLowerCase()
  const data = evt.data ?? {}

  let status: NormalizedStatus
  if (type.includes('refund') || type.includes('chargeback') || type.includes('dispute')) {
    status = 'REFUNDED'
  } else if (type === 'payment.succeeded' || type === 'payment_succeeded' || type.includes('went_valid')) {
    status = 'APPROVED'
  } else if (type.includes('failed')) {
    status = 'REJECTED'
  } else {
    return null // evento que no movemos (payment.pending, affiliate, etc.)
  }

  const externalId = String(
    data.id ?? data.receipt_id ?? data.payment_id ?? data.membership ?? '',
  )
  if (!externalId) return null

  // metadata puede venir en el pago, en la membership o en el plan según la
  // versión — se busca en todos lados.
  const meta = pickMetadata(data)
  const invoiceId = typeof meta.invoiceId === 'string' ? meta.invoiceId : undefined
  const abonoId = typeof meta.abonoId === 'string' ? meta.abonoId : undefined
  if (!invoiceId && !abonoId) return null

  const amount = Number(
    data.final_amount ?? data.subtotal ?? data.amount ?? data.settled_amount ?? 0,
  )
  const currency = String(data.currency ?? data.base_currency ?? 'usd').toUpperCase()

  return { provider: 'WHOP', externalId, status, amount, currency, invoiceId, abonoId, raw: evt }
}

function pickMetadata(data: Record<string, unknown>): Record<string, unknown> {
  const sources = [
    data.metadata,
    (data.checkout_session as Record<string, unknown> | undefined)?.metadata,
    (data.membership as Record<string, unknown> | undefined)?.metadata,
    (data.plan as Record<string, unknown> | undefined)?.metadata,
  ]
  for (const s of sources) {
    if (s && typeof s === 'object') return s as Record<string, unknown>
  }
  return {}
}
