import {
  GoogleGenAI,
  FunctionCallingConfigMode,
  HarmCategory,
  HarmBlockThreshold,
  ThinkingLevel,
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
import { looksAbusive, ABUSE_MAX_REPLIES_PER_HOUR, ABUSE_MAX_REPLIES_PER_DAY } from '@/lib/whatsapp-bot/abuse-guard'

// NISSI corre sobre Gemini Flash-Lite — un flujo guiado por herramientas como
// este no necesita razonamiento profundo, sí baja latencia (WhatsApp espera
// respuesta en segundos) y costo bajo (potencialmente cientos de mensajes por
// día). Precios (sep-2026, por 1M tokens entrada/salida): gemini-3.1-flash-lite
// $0.25/$1.50, gemini-2.5-flash-lite $0.10/$0.40 (bloqueado para proyectos
// nuevos), gemini-3.6-flash $0.75/$3.75. Google sacó gemini-2.5-flash para
// cuentas nuevas. El modelo exacto se lee de la config del plugin (default
// DEFAULT_GEMINI_MODEL) para poder cambiarlo sin deploy. El caché es IMPLÍCITO
// (se activa solo cuando el prefijo systemInstruction+tools se repite — no
// requiere código; se puede sumar caché explícito si
// usageMetadata.cachedContentTokenCount muestra baja tasa de acierto).
// Respuestas de WhatsApp son cortas — 600 alcanza de sobra. Más bajo = el
// modelo tiende a ser más conciso y genera más rápido (y no se paga texto
// de más si iba a divagar). Si algo se corta por MAX_TOKENS, hay reintento.
const MAX_OUTPUT_TOKENS = 600
// Tope de vueltas de tool-calling dentro de UN SOLO turno del cliente — un
// turno realista necesita como mucho buscar_catalogo + save_customer_info +
// una herramienta de handoff. Freno de seguridad contra un loop.
const MAX_TOOL_ROUNDS = 4
// Máximo de mensajes de historial que se le reenvían al modelo por turno.
const HISTORY_LIMIT = 40

// Debounce: los clientes de WhatsApp mandan varios mensajes cortos seguidos
// ("Gral pico" / "Ranqueles 7" / "que la instalen"). Sin esto, cada uno
// dispara una llamada completa al modelo. Se persiste el mensaje entrante y
// se espera un ratito; si mientras tanto llegó otro mensaje del cliente,
// esta invocación se retira y deja que la última procese el batch completo
// (el historial se reenvía entero igual). Ver el chequeo de `newest` en
// handleIncomingWhatsAppMessage. 1800ms atrapa la mayoría de los "bursts"
// (la gente manda el 2º mensaje en ~1s) y le saca 0,7s a la latencia de
// cada turno.
const DEBOUNCE_MS = 1800

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

// Finish reasons que son un bloqueo real de contenido (avisar a un humano,
// no reintentar). MALFORMED_FUNCTION_CALL NO va acá — el modelo se
// autocorrige solo la vuelta siguiente (más probable con thinking apagado),
// así que se trata como "corté sin respuesta" y cae al reintento sin tools.
const BLOCKING_FINISH_REASONS = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION'])

// Red de seguridad de SALIDA, independiente del modelo: NISSI no puede mandar
// precios ni datos de acceso ni links, ni por jailbreak ni por alucinación.
// El prompt ya lo prohíbe; esto es el segundo cerrojo. Conservador a propósito
// — "4 canales", "1080p", "8 MP", "2 años de garantía" NO matchean.
const OUTBOUND_LEAK_PATTERN = new RegExp(
  [
    '(?:\\$|us\\$|u\\$s|usd|ars|eur|€)\\s?\\d',          // $1000, US$ 50, USD30
    '\\d[\\d.,]*\\s?(?:pesos|d[oó]lares|usd|ars|euros?)\\b', // 1000 pesos, 50 dólares
    '\\b(?:contrase[nñ]a|password|credencial(?:es)?|clave de acceso|usuario y (?:clave|contrase[nñ]a))\\b',
    'https?://',                                          // NISSI nunca manda links
  ].join('|'),
  'i',
)

// Apagar / minimizar el "pensar" del modelo — NISSI es un flujo guiado por
// herramientas, no razona, y los tokens de razonamiento se facturan como
// salida. Gemini 2.5 usa thinkingBudget:0 (apagado total). Gemini 3.x no
// acepta budget y no se puede apagar del todo: thinkingLevel 'LOW' es el
// mínimo que soportan todos los 3.x ('MINIMAL' no está en 3.7/3.8). Gemini
// 2.0/1.5 no aceptan thinkingConfig (devuelven 400).
function thinkingConfigFor(model: string): { thinkingConfig?: { thinkingBudget?: number; thinkingLevel?: ThinkingLevel } } {
  if (model.includes('-2.5')) return { thinkingConfig: { thinkingBudget: 0 } }
  if (model.includes('-2.0') || model.includes('-1.5')) return {}
  return { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
}

// Texto de la respuesta sacado directamente de los parts (evita el
// console.warn del getter res.text cuando hay parts de functionCall).
// Salta los parts de "thought" (por si alguien apunta geminiModel a un
// modelo con thinking prendido) y une con salto de línea.
function extractText(cand: { content?: { parts?: Part[] } } | undefined): string {
  const parts = cand?.content?.parts ?? []
  return parts
    .filter((p) => !(p as { thought?: boolean }).thought)
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim()
}

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
  // null cuando el plugin no tiene todas las credenciales (ej. falta la API
  // key de Gemini) — el mensaje se guarda igual y aparece en el inbox, pero
  // NISSI no lo responde. Ver resolveOrgByPhoneNumberId.
  botConfig: WhatsAppBotConfig | null
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

const NUDGE_TEXT =
  'Contame en un mensaje qué necesitás (alarmas, cámaras, monitoreo) y te ayudo. Si son mensajes sueltos no voy a poder seguir respondiendo por acá.'

/**
 * Corre ANTES de llamar a Gemini. Devuelve true si el turno se frenó (relleno,
 * repetición, o NISSI ya contestó demasiado en poco tiempo) — el caller debe
 * cortar sin llamar al modelo. Marca los mensajes como procesados y manda UN
 * aviso por conversación (después, silencio). No molesta si ya la tomó un
 * humano.
 */
async function abuseGuardTripped(
  db: any,
  conversation: any,
  botConfig: WhatsAppBotConfig,
  msg: { orgId: string; customerPhone: string },
  // El techo de volumen (protección de costo / anti-loop) corre SIEMPRE.
  // El detector de relleno/repetición sólo si abuseGuardEnabled.
  contentGuard: boolean,
): Promise<boolean> {
  const turnMsgs = await db.whatsAppMessage.findMany({
    where: { conversationId: conversation.id, role: 'user', processedAt: null },
    orderBy: { createdAt: 'asc' }, select: { content: true },
  })
  if (turnMsgs.length === 0) return false
  const turnText = turnMsgs.map((m: any) => m.content).join(' ')

  const now = Date.now()
  const [repliesHour, repliesDay, priorUser] = await Promise.all([
    db.whatsAppMessage.count({ where: { conversationId: conversation.id, role: 'assistant', createdAt: { gte: new Date(now - 60 * 60 * 1000) } } }),
    db.whatsAppMessage.count({ where: { conversationId: conversation.id, role: 'assistant', createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) } } }),
    contentGuard
      ? db.whatsAppMessage.findMany({ where: { conversationId: conversation.id, role: 'user', processedAt: { not: null } }, orderBy: { createdAt: 'desc' }, take: 5, select: { content: true } })
      : Promise.resolve([] as { content: string }[]),
  ])
  const overLimit = repliesHour >= ABUSE_MAX_REPLIES_PER_HOUR || repliesDay >= ABUSE_MAX_REPLIES_PER_DAY
  const verdict = contentGuard ? looksAbusive(turnText, priorUser.map((m: any) => m.content)) : { abusive: false, reason: '' }

  if (!verdict.abusive && !overLimit) return false

  await markUserMessagesProcessed(db, conversation.id)
  const reason = overLimit ? `volumen (${repliesHour}/h, ${repliesDay}/día)` : verdict.reason
  const cd = (conversation.collectedData as Record<string, unknown> | null) ?? {}
  const alreadyNudged = typeof cd._abuseNudgedAt === 'string'
  console.warn('[NISSI ENGINE] turno frenado por anti-abuso', { conversationId: conversation.id, reason, alreadyNudged })

  // Si un humano ya tomó el hilo, no mandamos nada (lo ve en el inbox).
  const humanHandling =
    conversation.humanTakeoverAt &&
    now - new Date(conversation.humanTakeoverAt).getTime() <= HUMAN_TAKEOVER_AUTO_RELEASE_MS

  if (!alreadyNudged && !humanHandling) {
    await db.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { collectedData: { ...cd, _abuseNudgedAt: new Date().toISOString() } },
    })
    // Contenido de relleno = basura, se marca leída (no molesta a nadie).
    // Tope de volumen = puede ser un cliente real trabado / abuso sostenido —
    // se deja SIN leer y se avisa a un humano una vez.
    await persistAndSendOutbound(db, msg.orgId, conversation.id, botConfig, msg.customerPhone, NUDGE_TEXT, {
      markConversationRead: !overLimit,
    })
    if (overLimit) {
      const to = botConfig.salesContactEmail || botConfig.billingContactEmail
      if (to) {
        notifyHuman({
          orgId: msg.orgId, toEmail: to, toName: null,
          subject: 'NISSI frenó una conversación de WhatsApp por volumen',
          heading: 'Revisá esta conversación de WhatsApp',
          bodyText: `NISSI dejó de responder al número ${msg.customerPhone} porque ya contestó demasiadas veces en poco tiempo (${repliesHour} en la última hora). Puede ser abuso o un cliente que quedó trabado. Entrá a Conversaciones en el CRM y revisalo.`,
        })
      }
    }
  }
  return true
}

/** Guarda un mensaje saliente de NISSI, lo manda por WhatsApp, y deja
 *  registrado el id de Meta + el estado de entrega (para los ticks del
 *  inbox y para saber si un envío falló). */
async function persistAndSendOutbound(
  db: any,
  orgId: string,
  conversationId: string,
  botConfig: WhatsAppBotConfig,
  customerPhone: string,
  text: string,
  // markConversationRead: NISSI resolvió el turno por sí sola → adelantar
  // lastReadAt para que la conversación NO quede marcada como no-leída en el
  // inbox. Se pasa false cuando la respuesta es el fallback de "en un rato te
  // contesta un asesor" (ahí SÍ queremos que una persona la vea).
  opts?: { markConversationRead?: boolean },
): Promise<void> {
  const [row] = await Promise.all([
    db.whatsAppMessage.create({
      data: { conversationId, organizationId: orgId, role: 'assistant', content: text },
      select: { id: true },
    }),
    db.whatsAppConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(), ...(opts?.markConversationRead ? { lastReadAt: new Date() } : {}) },
    }),
  ])
  const sent = await sendWhatsAppBotMessage(botConfig.apiToken, botConfig.phoneNumberId, customerPhone, text)
  await db.whatsAppMessage.update({
    where: { id: row.id },
    data: sent.ok
      ? { waMessageId: sent.messageId ?? null, deliveryStatus: 'sent' }
      : { deliveryStatus: 'failed', deliveryError: sent.error ?? 'Error al enviar' },
  })
  if (!sent.ok) console.error('[NISSI ENGINE] no se pudo mandar la respuesta', sent.error, { conversationId })
}

/** Punto de entrada del webhook para un mensaje entrante. Persiste el
 *  mensaje, aplica el debounce, y si esta invocación es la que tiene que
 *  contestar, corre el turno contra Gemini. Idempotente por waMessageId. */
export async function handleIncomingWhatsAppMessage(msg: IncomingMessage): Promise<void> {
  const db = prisma as any

  // Idempotencia (Meta reintenta si no contestamos 200 a tiempo) + traer la
  // conversación — independientes, van juntas (Supabase está lejos de Vercel,
  // cada round-trip son ~250ms).
  const [already, existingConv] = await Promise.all([
    db.whatsAppMessage.findUnique({ where: { waMessageId: msg.waMessageId }, select: { id: true } }),
    db.whatsAppConversation.findUnique({
      where: { organizationId_customerPhone: { organizationId: msg.orgId, customerPhone: msg.customerPhone } },
    }),
  ])
  if (already) return

  let conversation = existingConv
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
  }

  const now = new Date()

  // Plugin sin credenciales completas (ej. falta la API key de Gemini) — se
  // guarda el mensaje y aparece en el inbox para que un humano responda a
  // mano. NO se tocan estados de la conversación (reabrir, mergear origen) —
  // eso es cosa de NISSI.
  if (!msg.botConfig) {
    await db.whatsAppMessage.create({ data: { conversationId: conversation.id, organizationId: msg.orgId, role: 'user', content: msg.text, waMessageId: msg.waMessageId } })
    await db.whatsAppConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: now, lastInboundAt: now } })
    console.warn('[NISSI ENGINE] plugin sin config completa — mensaje guardado, NISSI no responde', { orgId: msg.orgId, conversationId: conversation.id })
    return
  }
  const botConfig = msg.botConfig

  if (conversation.status === 'CLOSED') {
    conversation = await db.whatsAppConversation.update({
      where: { id: conversation.id },
      // -5s de colchón por si el reloj de la DB va atrás del server — el
      // mensaje entrante (que se crea justo después) tiene que quedar dentro.
      data: { status: 'ACTIVE', collectedData: originLabel ? { origen: originLabel } : null, ticketId: null, dealId: null, handedOffTo: null, humanTakeoverAt: null, assignedUserId: null, contextResetAt: new Date(now.getTime() - 5000) },
    })
  } else if (originLabel && !(conversation.collectedData as Record<string, unknown> | null)?.origen) {
    conversation = await db.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { collectedData: { ...(conversation.collectedData as Record<string, unknown> | null ?? {}), origen: originLabel } },
    })
  }

  const [inbound] = await Promise.all([
    db.whatsAppMessage.create({
      data: { conversationId: conversation.id, organizationId: msg.orgId, role: 'user', content: msg.text, waMessageId: msg.waMessageId },
      select: { id: true },
    }),
    db.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now, lastInboundAt: now },
    }),
  ])

  // ── Debounce ──────────────────────────────────────────────────────────
  await new Promise((r) => setTimeout(r, DEBOUNCE_MS))
  // El chequeo de "¿soy el último mensaje?" y la recarga de la conversación
  // van juntos — si bajamos por no ser el último, perdimos una query pero
  // le sacamos un round-trip al camino común.
  const [newest, reloaded] = await Promise.all([
    db.whatsAppMessage.findFirst({
      where: { conversationId: conversation.id, role: 'user' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], // tiebreaker si dos createdAt empatan
      select: { id: true },
    }),
    db.whatsAppConversation.findUnique({ where: { id: conversation.id } }),
  ])
  if (newest?.id !== inbound.id) {
    // Llegó otro mensaje del cliente mientras esperábamos — la última
    // invocación procesa el batch completo.
    return
  }
  // La conversación pudo cambiar de estado durante el debounce (ej. un
  // humano la tomó desde el inbox).
  conversation = reloaded
  if (!conversation) return

  // ── Freno anti-abuso ──────────────────────────────────────────────────
  // Antes de gastar un token: si NISSI ya contestó demasiado en poco tiempo
  // (siempre), o el turno es puro relleno / repetición (si está activado),
  // no llama al modelo. Manda UN aviso por conversación y después se calla.
  if (await abuseGuardTripped(db, conversation, botConfig, msg, botConfig.abuseGuardEnabled)) return

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
      // Ya hay un ticket/deal abierto + se avisó por mail al derivar — el
      // badge del inbox no tiene que volver a saltar por este mensaje.
      await persistAndSendOutbound(db, msg.orgId, conversation.id, botConfig, msg.customerPhone,
        'Ya derivamos tu consulta a un responsable — en minutos se comunican con vos. Si es algo nuevo y distinto, contámelo y lo derivo también.',
        { markConversationRead: true })
      return
    }
    // El contexto se reinicia desde el primer mensaje de ESTE turno (los que
    // todavía no se procesaron) — no desde "ahora", porque el mensaje
    // entrante ya se guardó antes del debounce y quedaría fuera del historial.
    const firstOfTurn = await db.whatsAppMessage.findFirst({
      where: { conversationId: conversation.id, role: 'user', processedAt: null },
      orderBy: { createdAt: 'asc' }, select: { createdAt: true },
    })
    conversation = await db.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { status: 'ACTIVE', collectedData: originLabel ? { origen: originLabel } : null, ticketId: null, dealId: null, handedOffTo: null, contextResetAt: firstOfTurn?.createdAt ?? new Date() },
    })
  }

  // Sólo desde el último reinicio de contexto (si la conversación se reabrió
  // de cero) — no arrastra el transcript viejo al modelo. Cap a los últimos
  // HISTORY_LIMIT mensajes: una charla de NISSI antes de derivar rara vez pasa
  // de ~20 turnos, y un hilo patológicamente largo no debe inflar el costo ni
  // la latencia de cada llamada.
  const historyDesc = await db.whatsAppMessage.findMany({
    where: {
      conversationId: conversation.id,
      ...(conversation.contextResetAt ? { createdAt: { gte: conversation.contextResetAt } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT,
    select: { role: true, content: true },
  })
  let history = historyDesc.reverse()
  // Salvavidas: si el filtro por contextResetAt dejó todo afuera (skew de
  // reloj, timestamps raros), traer el historial reciente completo — mejor de
  // más contexto que un array vacío que rompe la llamada a Gemini.
  if (history.length === 0) {
    const fallbackDesc = await db.whatsAppMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
      select: { role: true, content: true },
    })
    history = fallbackDesc.reverse()
  }

  const adOrigin = (conversation.collectedData as Record<string, unknown> | null)?.origen
  const ai = new GoogleGenAI({ apiKey: botConfig.geminiApiKey })
  const model = botConfig.geminiModel || DEFAULT_GEMINI_MODEL
  const systemInstruction = buildNissiSystemPrompt(msg.orgName, botConfig, {
    adOrigin: typeof adOrigin === 'string' ? adOrigin : null,
    customerName: msg.customerName,
  })
  const contents = buildContents(history)

  let finalText = ''
  let handedOff: { to: string } | null = null
  // Se setea si NISSI no pudo generar una respuesta de verdad (error de la
  // API, bloqueo de contenido, o se quedó sin texto útil). Al final se manda
  // UN aviso a un humano (evita mails duplicados por cada vuelta).
  let couldNotAnswer: string | null = null

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
          ...thinkingConfigFor(model),
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
      couldNotAnswer = 'error de la API de Gemini'
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
      couldNotAnswer = 'el modelo bloqueó la respuesta (filtro de contenido)'
      break
    }

    const calls = res.functionCalls ?? []
    const text = extractText(cand)
    // Sólo pisamos finalText con texto de una vuelta SIN herramientas — el
    // texto que acompaña a un functionCall suele ser un preámbulo ("dejame
    // que busco eso") que no sirve como respuesta final.
    if (text && calls.length === 0) finalText = text

    if (calls.length === 0) {
      if (!text && finish === 'MAX_TOKENS') {
        console.error('[NISSI ENGINE] respuesta truncada por MAX_TOKENS sin texto', { orgId: msg.orgId, conversationId: conversation.id })
        couldNotAnswer = 'la respuesta se cortó por límite de tokens'
      }
      break
    }

    // Sin los parts de "thought": si se reinyectan, el próximo request los
    // paga otra vez como input (y no aportan nada al contexto).
    const modelParts = (cand?.content?.parts ?? calls.map((c) => ({ functionCall: c })))
      .filter((p) => !(p as { thought?: boolean }).thought)
    contents.push({ role: 'model', parts: modelParts })

    const responseParts: Part[] = []
    for (const call of calls) {
      const fnName = call.name ?? ''
      const fnId = call.id
      const fr = (response: Record<string, unknown>): Part => ({
        functionResponse: { name: fnName, response, ...(fnId ? { id: fnId } : {}) },
      })
      if (handedOff) {
        responseParts.push(fr({ output: 'Esta conversación ya se derivó a un humano — no hace falta crear otro registro.' }))
        continue
      }
      try {
        const result = await runWhatsAppBotTool(fnName, (call.args ?? {}) as Record<string, unknown>, {
          orgId: msg.orgId, conversationId: conversation.id, customerPhone: msg.customerPhone, botConfig,
        })
        if (result.handedOff) handedOff = result.handedOff
        responseParts.push(fr({ output: result.resultText }))
      } catch (err) {
        console.error('[NISSI ENGINE] tool error', fnName, err)
        responseParts.push(fr({ error: 'Error interno al ejecutar esta acción.' }))
      }
    }
    contents.push({ role: 'user', parts: responseParts })

    if (handedOff) {
      // Sin vuelta extra al modelo — texto fijo si no redactó confirmación.
      if (!finalText.trim()) finalText = handoffConfirmationText(handedOff.to)
      break
    }
  }

  // Se agotaron las vueltas de herramientas sin una respuesta de texto
  // limpia (y sin handoff) — una última llamada SIN herramientas para que
  // redacte la respuesta con lo que ya juntó, en vez de mandar el fallback
  // genérico o un preámbulo.
  if (!handedOff && !finalText.trim()) {
    try {
      const res = await ai.models.generateContent({
        model, contents,
        config: {
          systemInstruction, maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.4,
          safetySettings: SAFETY_SETTINGS,
          ...thinkingConfigFor(model),
        },
      })
      const t = extractText(res.candidates?.[0])
      if (t) finalText = t
    } catch (err) {
      console.error('[NISSI ENGINE] Gemini error en la vuelta final sin tools', err)
    }
  }

  if (!finalText.trim()) {
    if (handedOff) {
      finalText = handoffConfirmationText(handedOff.to)
    } else {
      finalText = 'Perdón, tuve un problema técnico. En un rato te contesta un asesor.'
      couldNotAnswer = couldNotAnswer ?? 'no generó una respuesta después de todas las vueltas'
    }
  }

  // Filtro de salida: si a pesar del prompt la respuesta trae un precio, un
  // dato de acceso o un link, NO se manda — se reemplaza y (si no derivó ya)
  // se avisa a un humano.
  if (OUTBOUND_LEAK_PATTERN.test(finalText)) {
    console.error('[NISSI ENGINE] respuesta bloqueada por el filtro de salida', {
      conversationId: conversation.id, sample: finalText.slice(0, 200),
    })
    finalText = handedOff
      ? handoffConfirmationText(handedOff.to)
      : 'Eso te lo confirma un asesor. Ya le paso tu consulta así te contactan.'
    if (!handedOff) couldNotAnswer = couldNotAnswer ?? 'el filtro de salida detectó un precio / dato sensible'
  }

  // No pudo responder de verdad y no derivó → avisar a un humano (una sola
  // vez) para que entre al inbox. Si no hay mail configurado, el único aviso
  // es el badge de no-leídos del inbox.
  if (couldNotAnswer && !handedOff) {
    const to = botConfig.salesContactEmail || botConfig.billingContactEmail
    if (to) {
      notifyHuman({
        orgId: msg.orgId, toEmail: to, toName: null,
        subject: 'NISSI no pudo responder un WhatsApp',
        heading: 'Revisá esta conversación de WhatsApp',
        bodyText: `NISSI no pudo generar una respuesta para el número ${msg.customerPhone} (${couldNotAnswer}). El cliente recibió un mensaje de "en un rato te contesta un asesor". Entrá a Conversaciones en el CRM y respondé vos.`,
      })
    }
  }

  // Marcar procesado siempre (los dos caminos lo hacen) + chequear si un
  // humano tomó el hilo mientras el modelo generaba — en paralelo.
  const [fresh] = await Promise.all([
    db.whatsAppConversation.findUnique({ where: { id: conversation.id }, select: { humanTakeoverAt: true } }),
    markUserMessagesProcessed(db, conversation.id),
  ])
  if (fresh?.humanTakeoverAt) {
    console.warn('[NISSI ENGINE] un humano tomó el hilo mientras se generaba — no se manda la respuesta de NISSI', { conversationId: conversation.id })
    return
  }

  // Si NISSI contestó de verdad, la conversación queda "atendida" (no aparece
  // como no-leída). Si cayó al fallback genérico (couldNotAnswer), se deja
  // sin leer a propósito para que una persona entre al inbox.
  await persistAndSendOutbound(db, msg.orgId, conversation.id, botConfig, msg.customerPhone, finalText, {
    markConversationRead: !couldNotAnswer,
  })
}
