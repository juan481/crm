import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getPluginConfig } from '@/lib/plugins'
import { sendWhatsAppBotMessage } from '@/lib/whatsapp-bot/send'

export const dynamic = 'force-dynamic'

const WINDOW_MS = 24 * 60 * 60 * 1000

// Un humano responde a un cliente desde el inbox del CRM. Al responder,
// TOMA la conversación (humanTakeoverAt) — NISSI deja de contestar sola en
// ese hilo hasta que se lo devuelvan (POST .../takeover { active: false })
// o pasen 24hs sin actividad.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!message) return NextResponse.json({ error: 'El mensaje no puede estar vacío' }, { status: 400 })

    const db = prisma as any
    const conv = await db.whatsAppConversation.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true, customerPhone: true, lastInboundAt: true },
    })
    if (!conv) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })

    // Para responder desde el inbox sólo hacen falta las credenciales de
    // WhatsApp (no la key de Gemini) — así el inbox funciona aunque la org
    // todavía no haya cargado la key nueva del bot.
    const raw = await getPluginConfig(payload.orgId, 'whatsapp-ai-bot')
    const apiToken = typeof raw?.apiToken === 'string' ? raw.apiToken.trim() : ''
    const phoneNumberId = typeof raw?.phoneNumberId === 'string' ? raw.phoneNumberId.trim() : ''
    if (!apiToken || !phoneNumberId) {
      return NextResponse.json({ error: 'WhatsApp no está configurado — cargá el token y el Phone Number ID en Plugins.' }, { status: 409 })
    }

    // Ventana de 24hs de Meta: fuera de ella no se puede mandar texto libre.
    const windowOpen = !!conv.lastInboundAt && Date.now() - new Date(conv.lastInboundAt).getTime() < WINDOW_MS
    if (!windowOpen) {
      return NextResponse.json(
        { error: 'window_closed', message: 'El cliente no escribe hace más de 24 h. WhatsApp no permite mandarle un mensaje de texto libre hasta que vuelva a escribir.' },
        { status: 422 },
      )
    }

    const sent = await sendWhatsAppBotMessage(apiToken, phoneNumberId, conv.customerPhone, message)
    if (!sent.ok) {
      return NextResponse.json({ error: sent.error || 'WhatsApp rechazó el envío' }, { status: 502 })
    }

    const now = new Date()
    await db.whatsAppMessage.create({
      data: { conversationId: conv.id, role: 'assistant', content: message, senderUserId: payload.userId, processedAt: now },
    })
    // humanTakeoverAt se refresca en CADA respuesta humana — la
    // auto-liberación del engine (24hs) cuenta desde la última actividad del
    // humano, no desde la primera.
    await db.whatsAppConversation.update({
      where: { id: conv.id },
      data: {
        lastMessageAt: now,
        humanTakeoverAt: now,
        assignedUserId: payload.userId,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[CONVERSACION REPLY]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
