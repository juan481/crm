import crypto from 'crypto'
import type { CheckoutResult, NormalizedPaymentEvent, NormalizedStatus } from './types'

// ─── Mercado Pago (cobros en ARS) ────────────────────────────────────────
// Checkout Pro (preferences) para facturas puntuales + Suscripciones
// (preapproval) para débito automático. Todo por `fetch` con
// `Authorization: Bearer <MP_ACCESS_TOKEN>`.
//
// La fuente de verdad del estado de un pago NO es el body del webhook: el
// webhook sólo trae el id, después se hace GET /v1/payments/:id con el token.

const MP_API = 'https://api.mercadopago.com'

interface MpEnv {
  accessToken: string
  webhookSecret: string
}

function mpEnv(): MpEnv | null {
  const accessToken = process.env.MP_ACCESS_TOKEN
  const webhookSecret = process.env.MP_WEBHOOK_SECRET
  if (!accessToken || !webhookSecret) return null
  return { accessToken, webhookSecret }
}

export function mercadoPagoConfigured(): boolean {
  return mpEnv() !== null
}

async function mpFetch<T>(env: MpEnv, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const res = await fetch(`${MP_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${env.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`MP ${method} ${path} → ${res.status}: ${text.slice(0, 500)}`)
    return JSON.parse(text) as T
  } finally {
    clearTimeout(timeout)
  }
}

interface MpPreference { id: string; init_point: string; sandbox_init_point?: string }

/**
 * Crea una preference de Checkout Pro para pagar UNA factura.
 * `external_reference = invoiceId` es lo que después usa el webhook para
 * matchear el pago con la factura.
 */
export async function createMpInvoicePreference(opts: {
  amount: number
  currency: string
  concepto: string
  invoiceId: string
  payerEmail?: string | null
  successUrl: string
  notificationUrl: string
}): Promise<CheckoutResult> {
  const env = mpEnv()
  if (!env) throw new Error('Mercado Pago no está configurado (MP_ACCESS_TOKEN / MP_WEBHOOK_SECRET)')

  const pref = await mpFetch<MpPreference>(env, 'POST', '/checkout/preferences', {
    items: [
      {
        title: opts.concepto.slice(0, 250),
        quantity: 1,
        unit_price: Number(opts.amount.toFixed(2)),
        currency_id: opts.currency.trim().toUpperCase(),
      },
    ],
    ...(opts.payerEmail ? { payer: { email: opts.payerEmail } } : {}),
    external_reference: opts.invoiceId,
    back_urls: { success: opts.successUrl, pending: opts.successUrl, failure: opts.successUrl },
    auto_return: 'approved',
    notification_url: opts.notificationUrl,
    // Evita que MP guarde tarjeta / ofrezca cuotas sin interés por su cuenta.
    binary_mode: true,
  })

  return { url: pref.init_point, ref: pref.id }
}

interface MpPreapproval { id: string; init_point: string }

/**
 * Crea una suscripción (preapproval) con débito automático mensual para un
 * abono. Devuelve el link de autorización que se le manda al cliente 1 vez.
 * `external_reference = abonoId`.
 */
export async function createMpAbonoPreapproval(opts: {
  amount: number
  currency: string
  concepto: string
  abonoId: string
  frequencyMonths: number
  payerEmail?: string | null
  backUrl: string
  notificationUrl: string
}): Promise<{ authUrl: string; externalId: string }> {
  const env = mpEnv()
  if (!env) throw new Error('Mercado Pago no está configurado')

  const pre = await mpFetch<MpPreapproval>(env, 'POST', '/preapproval', {
    reason: opts.concepto.slice(0, 250),
    external_reference: opts.abonoId,
    ...(opts.payerEmail ? { payer_email: opts.payerEmail } : {}),
    auto_recurring: {
      frequency: opts.frequencyMonths,
      frequency_type: 'months',
      transaction_amount: Number(opts.amount.toFixed(2)),
      currency_id: opts.currency.trim().toUpperCase(),
    },
    back_url: opts.backUrl,
    notification_url: opts.notificationUrl,
    status: 'pending',
  })

  return { authUrl: pre.init_point, externalId: pre.id }
}

// ─── Verificación del webhook ────────────────────────────────────────────
// MP manda `x-signature: ts=<unix>,v1=<hmac hex>` y `x-request-id: <uuid>`.
// El manifiesto a firmar es `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
// con HMAC-SHA256(MP_WEBHOOK_SECRET) en hex.
// Ver: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks

interface MpWebhookRef {
  /** 'payment' | 'subscription_authorized_payment' | 'subscription_preapproval' */
  topic: string
  /** id del recurso a consultar en la API de MP */
  dataId: string
}

export function verifyMpWebhookSignature(opts: {
  dataId: string
  requestId: string | null
  signatureHeader: string | null
}): boolean {
  const env = mpEnv()
  if (!env) return false
  if (!opts.signatureHeader) return false

  const parts = Object.fromEntries(
    opts.signatureHeader.split(',').map((kv) => {
      const [k, v] = kv.split('=')
      return [k?.trim(), v?.trim()]
    }),
  ) as { ts?: string; v1?: string }
  if (!parts.ts || !parts.v1) return false

  // El manifiesto usa el id en minúsculas si es alfanumérico.
  const idForManifest = /^[a-z0-9-]+$/i.test(opts.dataId) ? opts.dataId.toLowerCase() : opts.dataId
  const manifest = `id:${idForManifest};request-id:${opts.requestId ?? ''};ts:${parts.ts};`
  const expected = crypto.createHmac('sha256', env.webhookSecret).update(manifest).digest('hex')

  try {
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(parts.v1, 'hex')
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/** Extrae topic + id del request del webhook (query string o body). */
export function parseMpWebhookRef(url: URL, body: unknown): MpWebhookRef | null {
  const b = (body ?? {}) as Record<string, unknown>
  const topic =
    url.searchParams.get('type') ||
    url.searchParams.get('topic') ||
    (typeof b.type === 'string' ? b.type : '') ||
    (typeof b.topic === 'string' ? b.topic : '')
  const dataId =
    url.searchParams.get('data.id') ||
    url.searchParams.get('id') ||
    (b.data && typeof b.data === 'object' ? String((b.data as Record<string, unknown>).id ?? '') : '') ||
    (typeof b.id === 'string' ? b.id : '')
  if (!topic || !dataId) return null
  return { topic, dataId }
}

interface MpPayment {
  id: number | string
  status: string
  transaction_amount: number
  currency_id: string
  external_reference: string | null
  // Lo que efectivamente acredita MP después de su comisión — undefined en
  // pagos que MP todavía no liquidó (ej. en mediación).
  transaction_details?: { net_received_amount?: number }
}

interface MpAuthorizedPayment {
  id: number | string
  status: string
  transaction_amount?: number
  currency_id?: string
  preapproval_id?: string
  external_reference?: string | null
}

/**
 * Consulta el pago real en MP y lo normaliza. Es la fuente de verdad del
 * estado/monto — nunca se confía en el body del webhook para eso.
 */
export async function fetchMpPaymentEvent(ref: MpWebhookRef): Promise<NormalizedPaymentEvent | null> {
  const env = mpEnv()
  if (!env) return null

  if (ref.topic === 'payment') {
    const p = await mpFetch<MpPayment>(env, 'GET', `/v1/payments/${ref.dataId}`)
    return {
      provider: 'MERCADOPAGO',
      externalId: String(p.id),
      status: mapMpStatus(p.status),
      amount: Number(p.transaction_amount ?? 0),
      currency: String(p.currency_id ?? 'ARS').toUpperCase(),
      invoiceId: p.external_reference ?? undefined,
      netAmount: typeof p.transaction_details?.net_received_amount === 'number' ? p.transaction_details.net_received_amount : undefined,
      raw: p,
    }
  }

  if (ref.topic === 'subscription_authorized_payment') {
    const ap = await mpFetch<MpAuthorizedPayment>(env, 'GET', `/authorized_payments/${ref.dataId}`)
    // El abonoId está en el external_reference del preapproval — si el
    // authorized_payment no lo trae, se resuelve por preapproval_id.
    let abonoId = ap.external_reference ?? undefined
    if (!abonoId && ap.preapproval_id) {
      try {
        const pre = await mpFetch<{ external_reference?: string }>(env, 'GET', `/preapproval/${ap.preapproval_id}`)
        abonoId = pre.external_reference ?? undefined
      } catch { /* se maneja abajo */ }
    }
    if (!abonoId) return null
    return {
      provider: 'MERCADOPAGO',
      externalId: String(ap.id),
      status: mapMpStatus(ap.status),
      amount: Number(ap.transaction_amount ?? 0),
      currency: String(ap.currency_id ?? 'ARS').toUpperCase(),
      abonoId,
      raw: ap,
    }
  }

  // subscription_preapproval (cambios de estado de la suscripción) — lo maneja
  // el route del webhook directamente, no genera un Payment.
  return null
}

/** Estado del preapproval (ACTIVO/PAUSADO/CANCELADO) para reflejar en el abono. */
export async function fetchMpPreapprovalStatus(preapprovalId: string): Promise<string | null> {
  const env = mpEnv()
  if (!env) return null
  try {
    const pre = await mpFetch<{ status?: string }>(env, 'GET', `/preapproval/${preapprovalId}`)
    switch ((pre.status ?? '').toLowerCase()) {
      case 'authorized': return 'ACTIVO'
      case 'paused': return 'PAUSADO'
      case 'cancelled': return 'CANCELADO'
      case 'pending': return 'PENDIENTE_AUTORIZACION'
      default: return null
    }
  } catch {
    return null
  }
}

function mapMpStatus(status: string): NormalizedStatus {
  switch ((status ?? '').toLowerCase()) {
    case 'approved':
    case 'authorized':
      return 'APPROVED'
    case 'refunded':
    case 'charged_back':
    case 'cancelled':
      return 'REFUNDED'
    case 'rejected':
    case 'in_mediation':
      return 'REJECTED'
    default:
      return 'PENDING'
  }
}
