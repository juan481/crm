import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import type { WhatsAppBotConfig } from '@/lib/whatsapp-bot/config'
import { buildNissiSystemPrompt } from '@/lib/whatsapp-bot/system-prompt'
import { WHATSAPP_BOT_TOOLS, runWhatsAppBotTool } from '@/lib/whatsapp-bot/tools'
import { sendWhatsAppBotMessage } from '@/lib/whatsapp-bot/send'

// Haiku alcanza y sobra para un flujo guiado por herramientas como este —
// no hace falta razonamiento profundo, sí baja latencia (WhatsApp espera
// respuesta en segundos) y costo bajo (potencialmente cientos de mensajes
// por día). Ver la memoria del proyecto para el resto del análisis de costo.
const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 1024
// Tope de vueltas de tool-calling dentro de UN SOLO mensaje entrante — nunca
// debería hacer falta más de un par de herramientas por turno (guardar
// datos + eventualmente escalar), esto es sólo un freno de seguridad contra
// un loop si el modelo se cuelga pidiendo la misma herramienta.
const MAX_TOOL_ROUNDS = 6

// Cuando el mensaje llega desde un anuncio "Click to WhatsApp" (Facebook/
// Instagram Ads), Meta manda este objeto adentro del mensaje — es la forma
// de saber, sin preguntarle nada al cliente, de qué publicación vino
// (ver Fase 2 del embudo publicitario, memoria abba-bot-whatsapp-ia-spec).
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

// Bug real encontrado en auditoría: nada en el código escribía nunca
// `CLOSED`, así que un handoff (Ticket/Deal creado) dejaba ese número
// taponado PARA SIEMPRE — cualquier mensaje futuro, sea en 5 minutos o en 3
// meses, sea sobre lo mismo o algo totalmente distinto, sólo recibía el
// mensaje enlatado de "ya derivamos" sin que la IA volviera a intervenir
// nunca, contradiciendo la propia promesa de ese mensaje ("si es algo
// nuevo, contámelo"). Se resuelve chequeando si el Ticket/Deal que motivó
// el handoff ya se cerró del lado humano — si es así, se considera "el caso
// terminó" y se reabre la charla de cero para lo que venga.
async function isHandoffStillOpen(db: any, conversation: { ticketId: string | null; dealId: string | null }): Promise<boolean> {
  if (conversation.ticketId) {
    const ticket = await db.ticket.findUnique({ where: { id: conversation.ticketId }, select: { status: true } })
    if (!ticket) return false // se borró — no hay nada que siga "abierto"
    return ticket.status !== 'RESUELTO' && ticket.status !== 'CERRADO'
  }
  if (conversation.dealId) {
    const deal = await db.deal.findUnique({ where: { id: conversation.dealId }, select: { stage: true } })
    if (!deal) return false
    return deal.stage !== 'GANADO' && deal.stage !== 'PERDIDO'
  }
  return false // handed off sin ticket ni deal asociado (no debería pasar) — no hay nada que bloquee
}

/** Punto de entrada del webhook para un mensaje de texto entrante — carga o
 *  crea la conversación, arma el historial, corre el loop de tool-calling
 *  contra Anthropic, y manda la respuesta final por WhatsApp. No relanza:
 *  si algo falla a mitad de camino, el mensaje entrante ya quedó guardado
 *  (idempotencia por waMessageId) así que un reintento de Meta no duplica
 *  nada, aunque sí puede reprocesar sin respuesta si falló ANTES de
 *  guardarlo — ver el chequeo de duplicado más abajo. */
export async function handleIncomingWhatsAppMessage(msg: IncomingMessage): Promise<void> {
  const db = prisma as any

  // Idempotencia: Meta reintenta la entrega del webhook si no contestamos
  // 200 a tiempo — si ya procesamos este waMessageId, no lo procesamos de
  // nuevo (evita mandar la respuesta duplicada o crear el ticket dos veces).
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
      // Dos mensajes del mismo cliente casi simultáneos pueden llegar como
      // dos invocaciones del webhook en paralelo (Meta no los agrupa
      // siempre en un solo POST) — la segunda choca contra el
      // @@unique([organizationId, customerPhone]) porque la primera ya
      // creó la fila microsegundos antes. Sin este catch, esa segunda
      // ejecución explotaba silenciosamente (el error sólo se logueaba en
      // el .catch del waitUntil del webhook) y ese mensaje del cliente se
      // guardaba pero JAMÁS recibía respuesta. Se resuelve releyendo la
      // fila que la otra ejecución ya creó, y siguiendo normal con esa.
      if (err.code !== 'P2002') throw err
      conversation = await db.whatsAppConversation.findUnique({
        where: { organizationId_customerPhone: { organizationId: msg.orgId, customerPhone: msg.customerPhone } },
      })
      if (!conversation) throw err
    }
  } else if (conversation.status === 'CLOSED') {
    // Charla vieja que se retoma — vuelve a ACTIVE, arranca de cero
    // (no tiene sentido arrastrar el contexto de una charla ya cerrada).
    conversation = await db.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { status: 'ACTIVE', collectedData: originLabel ? { origen: originLabel } : null, ticketId: null, dealId: null, handedOffTo: null },
    })
  } else if (originLabel && !(conversation.collectedData as Record<string, unknown> | null)?.origen) {
    // Conversación activa que todavía no tenía origen guardado (ej. el
    // cliente escribió una vez sin venir de un anuncio, y ahora sí) — lo
    // sumamos sin pisar el resto de collectedData ya juntado.
    conversation = await db.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { collectedData: { ...(conversation.collectedData as Record<string, unknown> | null ?? {}), origen: originLabel } },
    })
  }

  await db.whatsAppMessage.create({
    data: { conversationId: conversation.id, role: 'user', content: msg.text, waMessageId: msg.waMessageId },
  })
  await db.whatsAppConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } })

  // Ya se derivó a un humano — NISSI no vuelve a opinar sola MIENTRAS ese
  // caso siga abierto (evita pisar lo que un humano ya está resolviendo).
  if (conversation.status === 'HANDED_OFF') {
    const stillOpen = await isHandoffStillOpen(db, conversation)
    if (stillOpen) {
      const sent = await sendWhatsAppBotMessage(msg.botConfig.apiToken, msg.botConfig.phoneNumberId, msg.customerPhone,
        'Ya derivamos tu consulta a un responsable — en minutos se comunican con vos. Si es algo nuevo y distinto, contámelo y lo derivo también.')
      if (!sent.ok) console.error('[NISSI ENGINE] no se pudo mandar el aviso de "ya derivado"', sent.error, { orgId: msg.orgId, conversationId: conversation.id })
      return
    }
    // El caso ya se cerró del lado humano — se reabre de cero, mismo
    // criterio que una conversación CLOSED.
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
  const anthropic = new Anthropic({ apiKey: msg.botConfig.anthropicApiKey })
  const system = buildNissiSystemPrompt(msg.orgName, msg.botConfig, {
    adOrigin: typeof adOrigin === 'string' ? adOrigin : null,
    customerName: msg.customerName,
  })
  const messages: Anthropic.MessageParam[] = history.map((h: { role: string; content: string }) => ({
    role: h.role === 'assistant' ? 'assistant' : 'user',
    content: h.content,
  }))

  let finalText = ''
  let handedOff = false

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response: Anthropic.Message
    try {
      response = await anthropic.messages.create({
        // Una vez derivado, no se le vuelve a ofrecer ninguna herramienta —
        // bug real encontrado en auditoría: antes el modelo seguía teniendo
        // el toolset completo disponible en la vuelta "extra" que se le da
        // para redactar el texto de confirmación, y podía terminar
        // invocando OTRA herramienta de handoff (ej. create_support_ticket
        // Y create_sales_lead en la misma respuesta, o de nuevo en la
        // vuelta siguiente) — como ticketId/dealId son campos escalares que
        // cada llamada pisa, el primer Ticket/Deal creado quedaba huérfano
        // (existe, ya se le avisó al humano, pero la conversación sólo
        // apunta al segundo).
        model: MODEL, max_tokens: MAX_TOKENS, system, messages,
        ...(handedOff ? {} : { tools: WHATSAPP_BOT_TOOLS }),
      })
    } catch (err) {
      console.error('[NISSI ENGINE] Anthropic error', err)
      finalText = 'Perdón, tuve un problema técnico. En un rato te contesta un asesor.'
      break
    }

    const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text')
    if (textBlocks.length) finalText = textBlocks.map((b) => b.text).join('\n\n')

    if (response.stop_reason !== 'tool_use') break

    const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    messages.push({ role: 'assistant', content: response.content })

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of toolUseBlocks) {
      if (handedOff) {
        // Ya se derivó con una herramienta anterior DENTRO de esta misma
        // vuelta — no ejecutamos una segunda (mismo bug de arriba, pero la
        // variante de "dos tool_use en la misma respuesta de Claude").
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Esta conversación ya se derivó a un humano — no hace falta crear otro registro.' })
        continue
      }
      try {
        const result = await runWhatsAppBotTool(block.name, block.input as Record<string, unknown>, {
          orgId: msg.orgId, conversationId: conversation.id, customerPhone: msg.customerPhone, botConfig: msg.botConfig,
        })
        if (result.handedOff) handedOff = true
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result.resultText })
      } catch (err) {
        console.error('[NISSI ENGINE] tool error', block.name, err)
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Error interno al ejecutar esta acción.', is_error: true })
      }
    }
    messages.push({ role: 'user', content: toolResults })

    if (handedOff && !finalText) {
      // El modelo puede cortar en tool_use sin texto final en la misma
      // vuelta — le damos UNA vuelta más para que redacte la confirmación
      // (sin tools disponibles, ver arriba), pero si ya se derivó no hace
      // falta seguir loopeando de más.
      continue
    }
    if (handedOff) break
  }

  if (!finalText.trim()) {
    finalText = handedOff
      ? 'Listo, ya quedó cargado. En minutos un asesor o responsable de área se comunicará con usted.'
      : 'Contame un poco más para poder ayudarte.'
  }

  await db.whatsAppMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: finalText } })
  // Bug real encontrado en auditoría: este resultado se descartaba sin
  // chequear `ok` — si Meta rechaza el envío (token vencido, ventana de
  // 24hs de servicio al cliente cerrada, número bloqueado, rate limit),
  // el cliente se quedaba sin la respuesta Y sin ningún rastro en logs de
  // que eso había pasado.
  const sent = await sendWhatsAppBotMessage(msg.botConfig.apiToken, msg.botConfig.phoneNumberId, msg.customerPhone, finalText)
  if (!sent.ok) console.error('[NISSI ENGINE] no se pudo mandar la respuesta final', sent.error, { orgId: msg.orgId, conversationId: conversation.id })
}
