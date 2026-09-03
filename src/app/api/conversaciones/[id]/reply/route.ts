import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getPluginConfig } from '@/lib/plugins'
import { sendWhatsAppBotMessage } from '@/lib/whatsapp-bot/send'
import { canReplyToConversations } from '@/lib/whatsapp-bot/permissions'

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
    if (!(await canReplyToConversations(payload.orgId, payload.role))) {
      return NextResponse.json({ error: 'Tu rol puede ver la bandeja pero no responder. Pedile a un administrador que lo habilite en Configuración → NISSI.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!message) return NextResponse.json({ error: 'El mensaje no puede estar vacío' }, { status: 400 })

    const db = prisma as any
    const conv = await db.whatsAppConversation.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true, customerPhone: true, lastInboundAt: true, humanTakeoverAt: true },
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

    // Orden importante: se persiste el mensaje y se TOMA la conversación
    // ANTES de llamar a Meta. Si el envío responde OK, listo; si la respuesta
    // se pierde (timeout) pero Meta igual lo procesó, el mensaje ya quedó en
    // el transcript y la conversación ya está tomada → NISSI no habla encima
    // aunque el cliente conteste. El estado de entrega se ajusta después.
    const now = new Date()
    const created = await db.whatsAppMessage.create({
      data: {
        conversationId: conv.id, organizationId: payload.orgId, role: 'assistant', content: message,
        senderUserId: payload.userId, processedAt: now, deliveryStatus: 'pending',
      },
      select: { id: true, createdAt: true },
    })
    // humanTakeoverAt se refresca en CADA respuesta humana — la
    // auto-liberación del engine (24hs) cuenta desde la última actividad.
    await db.whatsAppConversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: now, humanTakeoverAt: now, assignedUserId: payload.userId },
    })

    const sent = await sendWhatsAppBotMessage(apiToken, phoneNumberId, conv.customerPhone, message)
    await db.whatsAppMessage.update({
      where: { id: created.id },
      data: sent.ok
        ? { waMessageId: sent.messageId ?? null, deliveryStatus: 'sent' }
        : { deliveryStatus: 'failed', deliveryError: sent.error ?? 'Error al enviar' },
    })

    if (!sent.ok) {
      return NextResponse.json(
        { error: sent.error || 'WhatsApp rechazó el envío', persisted: true },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      message: {
        id: created.id, role: 'assistant', content: message, createdAt: created.createdAt,
        author: 'vos', fromHuman: true, deliveryStatus: 'sent',
      },
    })
  } catch (error) {
    console.error('[CONVERSACION REPLY]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
