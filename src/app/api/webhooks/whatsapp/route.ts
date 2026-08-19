import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { waitUntil } from '@vercel/functions'
import { prisma } from '@/lib/db'
import { resolveOrgByPhoneNumberId } from '@/lib/whatsapp-bot/resolve-org'
import { handleIncomingWhatsAppMessage } from '@/lib/whatsapp-bot/engine'

export const dynamic = 'force-dynamic'

// Webhook ÚNICO compartido por todas las organizaciones que activen el
// plugin whatsapp-ai-bot — así funciona la Cloud API de Meta: se registra
// una sola URL a nivel de la App de Meta, y cada organización suscribe su
// propio número (WABA) a esa misma App. Quién es el dueño de cada mensaje
// se resuelve adentro por `metadata.phone_number_id` (ver resolve-org.ts).

// GET — handshake de verificación que hace Meta al guardar la URL del
// webhook en su dashboard ("Verificar y guardar"). El verify_token es un
// secreto compartido elegido acá (no viene de Meta), configurado una sola
// vez como variable de entorno — no es por-organización porque este
// handshake no manda ningún dato que identifique a una organización.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  if (!expected) {
    console.error('[WHATSAPP WEBHOOK] Falta WHATSAPP_WEBHOOK_VERIFY_TOKEN en las variables de entorno')
    return new NextResponse('Not configured', { status: 500 })
  }
  if (mode === 'subscribe' && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET
  // Sin app secret configurado no podemos validar — se deja pasar (Meta
  // exige un 200 rápido y no hay forma de rechazar sólo lo sospechoso sin
  // el secreto), pero queda logueado para que se note en producción.
  if (!appSecret) { console.warn('[WHATSAPP WEBHOOK] WHATSAPP_APP_SECRET no configurado — firma no verificada'); return true }
  if (!signatureHeader?.startsWith('sha256=')) return false

  const expectedHex = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')
  const provided = signatureHeader.slice('sha256='.length)
  const expectedBuf = Buffer.from(expectedHex, 'hex')
  const providedBuf = Buffer.from(provided, 'hex')
  if (expectedBuf.length !== providedBuf.length) return false
  return timingSafeEqual(expectedBuf, providedBuf)
}

interface MetaMessage {
  from: string
  id: string
  type: string
  text?: { body: string }
  // Presente sólo cuando el mensaje viene de un botón "Enviar mensaje" de
  // un anuncio de WhatsApp (Facebook/Instagram Ads, "Click to WhatsApp") —
  // ver Fase 2 del embudo publicitario, memoria abba-bot-whatsapp-ia-spec.
  referral?: { headline?: string; source_type?: string }
}
interface MetaChangeValue {
  metadata: { phone_number_id: string }
  contacts?: { profile?: { name?: string }; wa_id: string }[]
  messages?: MetaMessage[]
}

// POST — mensajes/eventos entrantes. Meta espera un 200 rápido (unos
// segundos) o reintenta la entrega — todo el trabajo pesado (llamar a
// Claude, escribir en la DB, mandar la respuesta) va en waitUntil para no
// bloquear la respuesta, misma técnica que el resto de los webhooks
// salientes de este proyecto (ver src/lib/webhooks.ts).
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!verifyMetaSignature(rawBody, req.headers.get('x-hub-signature-256'))) {
    console.error('[WHATSAPP WEBHOOK] Firma inválida')
    return new NextResponse('Forbidden', { status: 403 })
  }

  let payload: { entry?: { changes?: { value: MetaChangeValue }[] }[] }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  waitUntil(processPayload(payload).catch((err) => console.error('[WHATSAPP WEBHOOK] error procesando', err)))

  // Meta espera 200 apenas se recibe, no cuando termina de procesarse.
  return new NextResponse('EVENT_RECEIVED', { status: 200 })
}

async function processPayload(payload: { entry?: { changes?: { value: MetaChangeValue }[] }[] }): Promise<void> {
  const db = prisma as any
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      const messages = value.messages ?? []
      if (!messages.length) continue // status updates (delivered/read) u otros campos — no hay nada que contestar

      const phoneNumberId = value.metadata?.phone_number_id
      if (!phoneNumberId) continue

      const resolved = await resolveOrgByPhoneNumberId(phoneNumberId)
      if (!resolved) {
        console.error('[WHATSAPP WEBHOOK] Ningún organización tiene configurado este phone_number_id:', phoneNumberId)
        continue
      }

      const org = await db.organization.findUnique({ where: { id: resolved.orgId }, select: { name: true, crmName: true } })
      const orgName = org?.name || org?.crmName || 'nuestra empresa'

      for (const m of messages) {
        if (m.type !== 'text' || !m.text?.body) continue // por ahora sólo texto — audio/imagen/documento quedan sin contestar
        const contact = value.contacts?.find((c) => c.wa_id === m.from)

        await handleIncomingWhatsAppMessage({
          orgId: resolved.orgId,
          orgName,
          phoneNumberId,
          customerPhone: m.from,
          customerName: contact?.profile?.name ?? null,
          text: m.text.body,
          waMessageId: m.id,
          botConfig: resolved.config,
          adReferral: m.referral ? { headline: m.referral.headline, sourceType: m.referral.source_type } : null,
        })
      }
    }
  }
}
