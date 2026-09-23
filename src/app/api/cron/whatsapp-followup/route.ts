import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { getWhatsAppBotConfig } from '@/lib/whatsapp-bot/config'
import { sendWhatsAppBotMessage } from '@/lib/whatsapp-bot/send'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const WINDOW_MS = 24 * 60 * 60 * 1000

// Frases típicas de cierre/despedida — si el último mensaje de NISSI matchea
// esto, el cliente en silencio es normal (la charla ya se resolvió sola, no
// está "esperando"), no hay que insistir. Heurística simple a propósito
// (regex, cero costo/latencia de IA) — no es perfecta, pero cubre los casos
// típicos de Abba (agradecimiento, despedida, "cualquier cosa escribime").
const CLOSING_PATTERN = /gracias por (tu |el )?(mensaje|consulta|contact)|que tengas (un )?(lindo|buen) día|fue un placer|espero haberte ayudado|no dudes en (escrib|contact)|cualquier (cosa|duda|consulta).{0,20}(escrib|contact|avis)|hasta (luego|pronto)|saludos!?$|nos vemos|¡?gracias a vos!?$/i

// Corre cada pocos minutos (ver vercel.json). Para cada organización con
// NISSI activo y el seguimiento habilitado, busca charlas donde el ÚLTIMO
// mensaje fue nuestro (NISSI o un humano) y el cliente quedó en silencio
// más tiempo del configurado — le manda el recordatorio UNA sola vez por
// espera (followUpSentAt se resetea a null en engine.ts/reply route apenas
// sale un mensaje nuevo, así puede volver a dispararse la próxima vez).
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const db = prisma as any
    const orgs = await db.pluginConfig.findMany({
      where: { pluginId: 'whatsapp-ai-bot', enabled: true },
      select: { organizationId: true },
    })

    let sent = 0
    let checked = 0

    for (const { organizationId: orgId } of orgs) {
      const config = await getWhatsAppBotConfig(orgId)
      if (!config || !config.followUpEnabled) continue

      const cutoff = new Date(Date.now() - config.followUpMinutes * 60 * 1000)
      // GRACE_MS: tope de "qué tan viejo" puede ser el silencio para que
      // todavía cuente como candidato. Sin esto, si el cron estuvo caído (o
      // recién se prende la función por primera vez) y se acumula backlog,
      // en la próxima corrida se dispara un aviso a TODO ese backlog de
      // golpe — pasó en producción el 2026-09-23 (12 clientes reales
      // avisados de una sola vez). Con este tope, sólo se avisa el silencio
      // "fresco" (los primeros ~30 min después de cumplirse el plazo); un
      // silencio más viejo que eso ya no dispara el mensaje.
      const GRACE_MS = 30 * 60 * 1000
      const cutoffFloor = new Date(cutoff.getTime() - GRACE_MS)
      // importedAt: null — nunca tocar historial importado. status ACTIVE u
      // HANDED_OFF (no CLOSED). El filtro fino de "el último mensaje fue
      // nuestro" (lastMessageAt > lastInboundAt) se hace en JS abajo — no es
      // expresable directo en el where de Prisma comparando dos columnas.
      // status: sólo ACTIVE — si ya se derivó (HANDED_OFF, ticket/oportunidad
      // creada) el cliente ya sabe que un humano lo va a contactar; no tiene
      // sentido volver a preguntarle "¿seguís ahí?", la pelota queda de
      // nuestro lado, no del suyo (pedido de Abba, 2026-09-23).
      const candidates = await db.whatsAppConversation.findMany({
        where: {
          organizationId: orgId,
          importedAt: null,
          status: 'ACTIVE',
          followUpSentAt: null,
          lastMessageAt: { lte: cutoff, gte: cutoffFloor },
          lastInboundAt: { not: null },
        },
        select: {
          id: true, customerPhone: true, lastMessageAt: true, lastInboundAt: true,
          messages: { where: { role: 'assistant' }, orderBy: { createdAt: 'desc' }, take: 1, select: { content: true } },
        },
        take: 200,
      })

      for (const conv of candidates) {
        checked++
        const lastInboundAt = new Date(conv.lastInboundAt)
        const lastMessageAt = new Date(conv.lastMessageAt)
        if (lastMessageAt <= lastInboundAt) continue // el último mensaje fue del cliente, no hay nada que recordarle
        if (Date.now() - lastInboundAt.getTime() >= WINDOW_MS) continue // fuera de la ventana de 24hs, no se puede mandar texto libre
        // Si NISSI se despidió de forma natural (charla ya resuelta sola),
        // el silencio del cliente es normal — no insistir.
        const lastAssistantText = conv.messages[0]?.content ?? ''
        if (CLOSING_PATTERN.test(lastAssistantText)) continue

        const result = await sendWhatsAppBotMessage(config.apiToken, config.phoneNumberId, conv.customerPhone, config.followUpMessage)
        if (!result.ok) {
          console.error('[WHATSAPP FOLLOWUP] no se pudo mandar', { orgId, conversationId: conv.id, error: result.error })
          continue
        }
        const now = new Date()
        await Promise.all([
          db.whatsAppMessage.create({
            data: { conversationId: conv.id, organizationId: orgId, role: 'assistant', content: config.followUpMessage, waMessageId: result.messageId ?? null, deliveryStatus: 'sent' },
          }),
          db.whatsAppConversation.update({ where: { id: conv.id }, data: { lastMessageAt: now, followUpSentAt: now } }),
        ])
        sent++
      }
    }

    return NextResponse.json({ ok: true, orgsChecked: orgs.length, conversationsChecked: checked, sent })
  } catch (error) {
    console.error('[WHATSAPP FOLLOWUP]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
