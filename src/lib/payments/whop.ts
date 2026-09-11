import crypto from 'crypto'
import type { CheckoutResult, NormalizedPaymentEvent, NormalizedStatus } from './types'
import { WEBHOOK_MAX_SKEW_MS } from './types'

// ─── Whop (cobros en USD) ─────────────────────────────────────────────────
// API REST v1 (`api.whop.com/api/v1` — la vieja `/v2/plans` + `/v2/checkout_
// sessions` en dos pasos quedó deprecada por Whop, ver doc). Auth:
// `Authorization: Bearer <WHOP_API_KEY>`. Todo por `fetch` (mismo criterio
// que el resto del proyecto: Brevo, Graph API de WhatsApp, etc. — sin SDK).
// Whop deposita a la cuenta bancaria de Just Create; la conversión a USDT la
// hace Juan por fuera, para eso guardamos rawPayload.
//
// Un solo endpoint crea el plan + el link de pago juntos:
//   POST /checkout_configurations
//   { account_id: "biz_...", mode: "payment", redirect_url, metadata,
//     plan: { product_id: "prod_...", plan_type, initial_price, currency, ... } }
//   → { id: "ch_...", purchase_url: "https://whop.com/checkout/ch_...", plan: { id: "plan_..." } }
// Fuente: https://docs.whop.com/api-reference/beta/checkout-configurations/create-a-checkout-configuration
//
// `WHOP_SANDBOX=true` pega contra `sandbox-api.whop.com` para probar sin
// cobrar de verdad (ver crm/docs/PAGOS-Y-PORTAL.md).

function whopApiBase(): string {
  return process.env.WHOP_SANDBOX === 'true' || process.env.WHOP_SANDBOX === '1'
    ? 'https://sandbox-api.whop.com/api/v1'
    : 'https://api.whop.com/api/v1'
}
const WHOP_CHECKOUT_BASE = 'https://whop.com'

interface WhopEnv {
  apiKey: string
  productId: string
  companyId: string
  webhookSecret: string
}

function whopEnv(): WhopEnv | null {
  const apiKey = process.env.WHOP_API_KEY
  const productId = process.env.WHOP_PRODUCT_ID
  const companyId = process.env.WHOP_COMPANY_ID
  const webhookSecret = process.env.WHOP_WEBHOOK_SECRET
  if (!apiKey || !productId || !companyId || !webhookSecret) return null
  return { apiKey, productId, companyId, webhookSecret }
}

export function whopConfigured(): boolean {
  return whopEnv() !== null
}

async function whopFetch<T>(env: WhopEnv, path: string, body: unknown): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const res = await fetch(`${whopApiBase()}${path}`, {
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

interface WhopCheckoutConfig {
  id: string
  purchase_url: string | null
  plan?: { id: string } | null
}

/**
 * Crea un plan one-time con el monto exacto de la factura + su checkout ya
 * armado, en una sola llamada a /checkout_configurations. Devuelve la URL
 * hosteada.
 *
 * El monto SIEMPRE sale de `amount`/`currency` que le pasa el caller
 * (resueltos server-side desde Invoice.amount) — nunca de nada que venga del
 * navegador del cliente. `force_create_new_plan` evita que Whop reutilice un
 * plan viejo que matchee el mismo precio pero le falte el metadata de ESTA
 * factura.
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
  if (!env) throw new Error('Whop no está configurado (WHOP_API_KEY / WHOP_PRODUCT_ID / WHOP_COMPANY_ID / WHOP_WEBHOOK_SECRET)')

  const config = await whopFetch<WhopCheckoutConfig>(env, '/checkout_configurations', {
    account_id: env.companyId,
    mode: 'payment',
    redirect_url: opts.redirectUrl,
    metadata: { kind: 'invoice', invoiceId: opts.invoiceId, payToken: opts.payToken },
    plan: {
      product_id: env.productId,
      plan_type: 'one_time',
      initial_price: Number(opts.amount.toFixed(2)),
      currency: whopCurrency(opts.currency),
      description: opts.concepto.slice(0, 500),
      visibility: 'hidden',
      force_create_new_plan: true,
    },
  })
  if (!config.purchase_url) throw new Error('Whop no devolvió purchase_url')

  return { url: absoluteCheckoutUrl(config.purchase_url), ref: config.id }
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
  if (!env) throw new Error('Whop no está configurado (WHOP_API_KEY / WHOP_PRODUCT_ID / WHOP_COMPANY_ID / WHOP_WEBHOOK_SECRET)')

  const config = await whopFetch<WhopCheckoutConfig>(env, '/checkout_configurations', {
    account_id: env.companyId,
    mode: 'payment',
    redirect_url: opts.redirectUrl,
    metadata: { kind: 'abono', abonoId: opts.abonoId },
    plan: {
      product_id: env.productId,
      plan_type: 'renewal',
      initial_price: Number(opts.amount.toFixed(2)),
      renewal_price: Number(opts.amount.toFixed(2)),
      billing_period: opts.billingPeriodDays,
      currency: whopCurrency(opts.currency),
      description: opts.concepto.slice(0, 500),
      visibility: 'hidden',
      force_create_new_plan: true,
    },
  })
  if (!config.purchase_url || !config.plan?.id) throw new Error('Whop no devolvió purchase_url/plan.id')

  return { authUrl: absoluteCheckoutUrl(config.purchase_url), externalId: config.plan.id }
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
 * Verifica la firma del webhook. Devuelve el evento parseado si valida, o
 * null si: falta el secreto (fail-closed), faltan headers de firma, la firma
 * no valida, o el timestamp está fuera de la ventana de tolerancia.
 */
export function verifyWhopSignature(rawBody: string, headers: Headers): WhopEventEnvelope | null {
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

  try {
    return JSON.parse(rawBody) as WhopEventEnvelope
  } catch {
    return null
  }
}

/** Verifica firma + normaliza un evento de PAGO. null si no es un pago que movamos. */
export function verifyWhopWebhook(rawBody: string, headers: Headers): NormalizedPaymentEvent | null {
  const evt = verifyWhopSignature(rawBody, headers)
  return evt ? normalizeWhopEvent(evt) : null
}

/**
 * Estado de suscripción de un abono a partir de un evento de membership de
 * Whop YA verificado (verifyWhopSignature). null si el evento no cambia el
 * estado de una suscripción de abono.
 */
export function parseWhopSubStatusEvent(evt: WhopEventEnvelope): { abonoId: string; status: 'ACTIVO' | 'CANCELADO' | 'PAUSADO' } | null {
  const type = (evt.type || evt.action || '').toLowerCase()
  const data = evt.data ?? {}
  const meta = pickMetadata(data)
  const abonoId = typeof meta.abonoId === 'string' ? meta.abonoId : undefined
  if (!abonoId) return null

  if (type.includes('went_valid') || type === 'membership.activated') return { abonoId, status: 'ACTIVO' }
  if (type.includes('cancel') || type.includes('went_invalid') || type.includes('expired')) return { abonoId, status: 'CANCELADO' }
  if (type.includes('paus')) return { abonoId, status: 'PAUSADO' }
  return null
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
