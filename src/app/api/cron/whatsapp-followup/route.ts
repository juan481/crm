import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { getWhatsAppBotConfig } from '@/lib/whatsapp-bot/config'
import { sendWhatsAppBotMessage } from '@/lib/whatsapp-bot/send'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const WINDOW_MS = 24 * 60 * 60 * 1000

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
      // importedAt: null — nunca tocar historial importado. status ACTIVE u
      // HANDED_OFF (no CLOSED). El filtro fino de "el último mensaje fue
      // nuestro" (lastMessageAt > lastInboundAt) se hace en JS abajo — no es
      // expresable directo en el where de Prisma comparando dos columnas.
      const candidates = await db.whatsAppConversation.findMany({
        where: {
          organizationId: orgId,
          importedAt: null,
          status: { in: ['ACTIVE', 'HANDED_OFF'] },
          followUpSentAt: null,
          lastMessageAt: { lte: cutoff },
          lastInboundAt: { not: null },
        },
        select: { id: true, customerPhone: true, lastMessageAt: true, lastInboundAt: true },
        take: 200,
      })

      for (const conv of candidates) {
        checked++
        const lastInboundAt = new Date(conv.lastInboundAt)
        const lastMessageAt = new Date(conv.lastMessageAt)
        if (lastMessageAt <= lastInboundAt) continue // el último mensaje fue del cliente, no hay nada que recordarle
        if (Date.now() - lastInboundAt.getTime() >= WINDOW_MS) continue // fuera de la ventana de 24hs, no se puede mandar texto libre

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
