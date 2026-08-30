import {
  GoogleGenAI,
  FunctionCallingConfigMode,
  HarmCategory,
  HarmBlockThreshold,
  type Content,
  type Part,
  type SafetySetting,
} from '@google/genai'
import { prisma } from '@/lib/db'
import { DEFAULT_GEMINI_MODEL, type WhatsAppBotConfig } from '@/lib/whatsapp-bot/config'
import { buildNissiSystemPrompt } from '@/lib/whatsapp-bot/system-prompt'
import { WHATSAPP_BOT_TOOLS, runWhatsAppBotTool } from '@/lib/whatsapp-bot/tools'
import { sendWhatsAppBotMessage } from '@/lib/whatsapp-bot/send'
import { notifyHuman } from '@/lib/whatsapp-bot/notify'

// NISSI corre sobre Gemini Flash — un flujo guiado por herramientas como este
// no necesita razonamiento profundo, sí baja latencia (WhatsApp espera
// respuesta en segundos) y costo bajo (potencialmente cientos de mensajes por
// día). Precio verificado (ago-2026): Gemini 2.5 Flash ~USD 0.15-0.30 / 1M
// entrada, ~1.25-2.50 / 1M salida; Flash-Lite ~0.10 / 0.40. El modelo exacto
// se lee de la config del plugin (default DEFAULT_GEMINI_MODEL) para poder
// bajar a flash-lite sin deploy. El caché es IMPLÍCITO (Gemini 2.5 lo hace
// solo cuando el prefijo systemInstruction+tools se repite — no requiere
// código; se puede sumar caché explícito si usageMetadata.cachedContentTokenCount
// muestra baja tasa de acierto).
const MAX_OUTPUT_TOKENS = 800
// Tope de vueltas de tool-calling dentro de UN SOLO turno del cliente — un
// turno realista necesita como mucho buscar_catalogo + save_customer_info +
// una herramienta de handoff. Freno de seguridad contra un loop.
const MAX_TOOL_ROUNDS = 4

// Debounce: los clientes de WhatsApp mandan varios mensajes cortos seguidos
// ("Gral pico" / "Ranqueles 7" / "que la instalen"). Sin esto, cada uno
// dispara una llamada completa al modelo. Se persiste el mensaje entrante y
// se espera un ratito; si mientras tanto llegó otro mensaje del cliente,
// esta invocación se retira y deja que la última procese el batch completo
// (el historial se reenvía entero igual). Ver processConversationTurn.
const DEBOUNCE_MS = 2500

// Toma humana desde el inbox: si un humano tomó la conversación hace menos
// de esto, NISSI no contesta nada (el humano responde desde /conversaciones).
// Pasado el plazo, se libera sola en la próxima entrada.
const HUMAN_TAKEOVER_AUTO_RELEASE_MS = 24 * 60 * 60 * 1000

// El chat de alarmas/seguridad ("alarma disparada", "sensor perimetral",
// "central de monitoreo") es un falso positivo real de DANGEROUS_CONTENT con
// umbrales bajos. BLOCK_ONLY_HIGH: no requiere allow-list en la cuenta y
// igual frena lo genuinamente grave.
const SAFETY_SETTINGS: SafetySetting[] = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }))

const BLOCKING_FINISH_REASONS = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION'])

// Cuando el mensaje llega desde un anuncio "Click to WhatsApp" (Facebook/
// Instagram Ads), Meta manda este objeto adentro del mensaje — es la forma
// de saber, sin preguntarle nada al cliente, de qué publicación vino.
export interface AdReferral {
  headline?: string
  sourceType?: string
}

interface IncomingMessage {
  orgId: string
  orgName: string
  phoneNumberId: string
  customerPhone: string // wa_id, dígitos solamente
  customerName: string | null
  text: string
  waMessageId: string
  botConfig: WhatsAppBotConfig
  adReferral?: AdReferral | null
}

function buildOriginLabel(ref: AdReferral): string {
  return ref.headline ? `Facebook/Instagram Ads - ${ref.headline}` : 'Anuncio de WhatsApp (Facebook/Instagram Ads)'
}

function handoffConfirmationText(to: string): string {
  if (to === 'SOPORTE') return 'Listo, ya derivé tu consulta al equipo técnico. En minutos se comunican con vos.'
  if (to === 'ADMINISTRACION') return 'Listo, ya derivé tu consulta a Administración. En minutos se comunican con vos.'
  return 'Listo, ya le pasé tus datos a un asesor. En minutos se comunican con vos.'
}

// Reconstruye el historial para Gemini: assistant -> 'model', y fusiona
// mensajes consecutivos del mismo rol (Gemini espera roles alternados; con
// el debounce pueden quedar dos 'user' seguidos sin respuesta en el medio).
function buildContents(history: { role: string; content: string }[]): Content[] {
  const out: Content[] = []
  for (const h of history) {
    const role = h.role === 'assistant' ? 'model' : 'user'
    const last = out[out.length - 1]
    if (last && last.role === role) {
      ;(last.parts as Part[]).push({ text: h.content })
    } else {
      out.push({ role, parts: [{ text: h.content }] })
    }
  }
  return out
}

async function isHandoffStillOpen(db: any, conversation: { ticketId: string | null; dealId: string | null }): Promise<boolean> {
  if (conversation.ticketId) {
    const ticket = await db.ticket.findUnique({ where: { id: conversation.ticketId }, select: { status: true } })
    if (!ticket) return false
    return ticket.status !== 'RESUELTO' && ticket.status !== 'CERRADO'
  }
  if (conversation.dealId) {
    const deal = await db.deal.findUnique({ where: { id: conversation.dealId }, select: { stage: true } })
    if (!deal) return false
    return deal.stage !== 'GANADO' && deal.stage !== 'PERDIDO'
  }
  return false
}

async function markUserMessagesProcessed(db: any, conversationId: string): Promise<void> {
  await db.whatsAppMessage.updateMany({
    where: { conversationId, role: 'user', processedAt: null },
    data: { processedAt: new Date() },
  })
}

/** Punto de entrada del webhook para un mensaje entrante. Persiste el
 *  mensaje, aplica el debounce, y si esta invocación es la que tiene que
 *  contestar, corre el turno contra Gemini. Idempotente por waMessageId. */
export async function handleIncomingWhatsAppMessage(msg: IncomingMessage): Promise<void> {
  const db = prisma as any

  // Idempotencia: Meta reintenta la entrega si no contestamos 200 a tiempo.
  const already = await db.whatsAppMessage.findUnique({ where: { waMessageId: msg.waMessageId }, select: { id: true } })
  if (already) return

  let conversation = await db.whatsAppConversation.findUnique({
    where: { organizationId_customerPhone: { organizationId: msg.orgId, customerPhone: msg.customerPhone } },
  })
  const originLabel = msg.adReferral ? buildOriginLabel(msg.adReferral) : null
  if (!conversation) {
    try {
      conversation = await db.whatsAppConversation.create({
        data: {
          organizationId: msg.orgId, phoneNumberId: msg.phoneNumberId,
          customerPhone: msg.customerPhone, customerName: msg.customerName,
          status: 'ACTIVE',
          ...(originLabel && { collectedData: { origen: originLabel } }),
        },
      })
    } catch (err: any) {
      // Race: dos mensajes casi simultáneos = dos invocaciones del webhook,
      // la segunda choca contra @@unique([organizationId, customerPhone]).
      if (err.code !== 'P2002') throw err
      conversation = await db.whatsAppConversation.findUnique({
        where: { organizationId_customerPhone: { organizationId: msg.orgId, customerPhone: msg.customerPhone } },
      })
      if (!conversation) throw err
    }
  } else if (conversation.status === 'CLOSED') {
    conversation = await db.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { status: 'ACTIVE', collectedData: originLabel ? { origen: originLabel } : null, ticketId: null, dealId: null, handedOffTo: null, humanTakeoverAt: null, assignedUserId: null },
    })
  } else if (originLabel && !(conversation.collectedData as Record<string, unknown> | null)?.origen) {
    conversation = await db.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { collectedData: { ...(conversation.collectedData as Record<string, unknown> | null ?? {}), origen: originLabel } },
    })
  }

  const inbound = await db.whatsAppMessage.create({
    data: { conversationId: conversation.id, role: 'user', content: msg.text, waMessageId: msg.waMessageId },
    select: { id: true },
  })
  const now = new Date()
  await db.whatsAppConversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: now, lastInboundAt: now },
  })

  // ── Debounce ──────────────────────────────────────────────────────────
  await new Promise((r) => setTimeout(r, DEBOUNCE_MS))
  const newest = await db.whatsAppMessage.findFirst({
    where: { conversationId: conversation.id, role: 'user' },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  if (newest?.id !== inbound.id) {
    // Llegó otro mensaje del cliente mientras esperábamos — la última
    // invocación procesa el batch completo.
    return
  }

  // Recargar la conversación (pudo cambiar de estado durante el debounce,
  // ej. un humano la tomó desde el inbox).
  conversation = await db.whatsAppConversation.findUnique({ where: { id: conversation.id } })
  if (!conversation) return

  // ── Toma humana ───────────────────────────────────────────────────────
  if (conversation.humanTakeoverAt) {
    const ageMs = Date.now() - new Date(conversation.humanTakeoverAt).getTime()
    if (ageMs <= HUMAN_TAKEOVER_AUTO_RELEASE_MS) {
      // El humano maneja el hilo — NISSI no manda nada, el mensaje queda en
      // el inbox como no leído.
      await markUserMessagesProcessed(db, conversation.id)
      return
    }
    // Pasó el plazo sin actividad — se libera y NISSI retoma.
    conversation = await db.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { humanTakeoverAt: null, assignedUserId: null },
    })
  }

  // ── Ya derivado a un humano (ticket/deal) ─────────────────────────────
  if (conversation.status === 'HANDED_OFF') {
    const stillOpen = await isHandoffStillOpen(db, conversation)
    if (stillOpen) {
      await markUserMessagesProcessed(db, conversation.id)
      const sent = await sendWhatsAppBotMessage(msg.botConfig.apiToken, msg.botConfig.phoneNumberId, msg.customerPhone,
        'Ya derivamos tu consulta a un responsable — en minutos se comunican con vos. Si es algo nuevo y distinto, contámelo y lo derivo también.')
      if (!sent.ok) console.error('[NISSI ENGINE] no se pudo mandar el aviso de "ya derivado"', sent.error, { orgId: msg.orgId, conversationId: conversation.id })
      return
    }
    conversation = await db.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { status: 'ACTIVE', collectedData: originLabel ? { origen: originLabel } : null, ticketId: null, dealId: null, handedOffTo: null },
    })
  }

  const history = await db.whatsAppMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true },
  })

  const adOrigin = (conversation.collectedData as Record<string, unknown> | null)?.origen
  const ai = new GoogleGenAI({ apiKey: msg.botConfig.geminiApiKey })
  const model = msg.botConfig.geminiModel || DEFAULT_GEMINI_MODEL
  const systemInstruction = buildNissiSystemPrompt(msg.orgName, msg.botConfig, {
    adOrigin: typeof adOrigin === 'string' ? adOrigin : null,
    customerName: msg.customerName,
  })
  const contents = buildContents(history)

  let finalText = ''
  let handedOff: { to: string } | null = null

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let res: Awaited<ReturnType<typeof ai.models.generateContent>>
    try {
      res = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          temperature: 0.4,
          safetySettings: SAFETY_SETTINGS,
          // Sólo los modelos 2.5 aceptan thinkingConfig; 2.0 devuelve 400.
          ...(model.includes('2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          // Una vez derivado, no se le vuelve a ofrecer ninguna herramienta —
          // evita que el modelo invoque OTRA herramienta de handoff en la
          // vuelta de confirmación y deje el primer Ticket/Deal huérfano.
          ...(handedOff
            ? {}
            : {
                tools: [{ functionDeclarations: WHATSAPP_BOT_TOOLS }],
                toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
              }),
        },
      })
    } catch (err) {
      console.error('[NISSI ENGINE] Gemini error', err, { orgId: msg.orgId, conversationId: conversation.id })
      finalText = 'Perdón, tuve un problema técnico. En un rato te contesta un asesor.'
      break
    }

    const cand = res.candidates?.[0]
    const finish = cand?.finishReason as string | undefined
    if (res.promptFeedback?.blockReason || (finish && BLOCKING_FINISH_REASONS.has(finish))) {
      console.error('[NISSI ENGINE] Gemini bloqueó la respuesta', {
        blockReason: res.promptFeedback?.blockReason, finishReason: finish,
        orgId: msg.orgId, conversationId: conversation.id,
      })
      finalText = 'Perdón, tuve un problema técnico. En un rato te contesta un asesor.'
      // Que no se pierda: avisar a Ventas si hay email configurado.
      if (msg.botConfig.salesContactEmail) {
        notifyHuman({
          orgId: msg.orgId, toEmail: msg.botConfig.salesContactEmail, toName: null,
          subject: 'NISSI no pudo responder un WhatsApp (filtro de seguridad)',
          heading: 'Revisá esta conversación de WhatsApp',
          bodyText: `NISSI no pudo generar una respuesta para el número ${msg.customerPhone} (el modelo bloqueó la respuesta). Entrá a Conversaciones en el CRM y respondé vos.`,
        })
      }
      break
    }

    const calls = res.functionCalls ?? []
    const text = typeof res.text === 'string' ? res.text.trim() : ''
    if (text) finalText = text

    if (calls.length === 0) break

    contents.push({ role: 'model', parts: cand?.content?.parts ?? calls.map((c) => ({ functionCall: c })) })

    const responseParts: Part[] = []
    for (const call of calls) {
      const fnName = call.name ?? ''
      if (handedOff) {
        responseParts.push({ functionResponse: { name: fnName, response: { result: 'Esta conversación ya se derivó a un humano — no hace falta crear otro registro.' } } })
        continue
      }
      try {
        const result = await runWhatsAppBotTool(fnName, (call.args ?? {}) as Record<string, unknown>, {
          orgId: msg.orgId, conversationId: conversation.id, customerPhone: msg.customerPhone, botConfig: msg.botConfig,
        })
        if (result.handedOff) handedOff = result.handedOff
        responseParts.push({ functionResponse: { name: fnName, response: { result: result.resultText } } })
      } catch (err) {
        console.error('[NISSI ENGINE] tool error', fnName, err)
        responseParts.push({ functionResponse: { name: fnName, response: { error: 'Error interno al ejecutar esta acción.' } } })
      }
    }
    contents.push({ role: 'user', parts: responseParts })

    if (handedOff) {
      // Sin vuelta extra al modelo — texto fijo si no redactó confirmación.
      if (!finalText.trim()) finalText = handoffConfirmationText(handedOff.to)
      break
    }
  }

  if (!finalText.trim()) {
    finalText = handedOff
      ? handoffConfirmationText(handedOff.to)
      : 'Contame un poco más para poder ayudarte.'
  }

  // Un humano pudo tomar el hilo mientras el modelo generaba — si es así,
  // no mandamos la respuesta de NISSI (la maneja la persona desde el inbox).
  const fresh = await db.whatsAppConversation.findUnique({
    where: { id: conversation.id }, select: { humanTakeoverAt: true },
  })
  if (fresh?.humanTakeoverAt) {
    await markUserMessagesProcessed(db, conversation.id)
    console.warn('[NISSI ENGINE] un humano tomó el hilo mientras se generaba — no se manda la respuesta de NISSI', { conversationId: conversation.id })
    return
  }

  await markUserMessagesProcessed(db, conversation.id)
  await db.whatsAppMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: finalText } })
  await db.whatsAppConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } })

  const sent = await sendWhatsAppBotMessage(msg.botConfig.apiToken, msg.botConfig.phoneNumberId, msg.customerPhone, finalText)
  if (!sent.ok) console.error('[NISSI ENGINE] no se pudo mandar la respuesta final', sent.error, { orgId: msg.orgId, conversationId: conversation.id })
}
