import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { roleHasModule } from '@/lib/module-access'
import { getPluginConfig } from '@/lib/plugins'
import { parseWhatsAppBotConfig } from '@/lib/whatsapp-bot/config'
import { sendWhatsAppTemplate } from '@/lib/whatsapp-bot/send'
import { canReplyToConversations } from '@/lib/whatsapp-bot/permissions'

export const dynamic = 'force-dynamic'

// Reabrir una conversación FUERA de la ventana de 24hs con una plantilla
// (HSM) pre-aprobada por Meta — es la única forma permitida de mandarle
// algo a un cliente que no te escribió en más de 24hs. La plantilla se
// carga y aprueba del lado de Meta (WhatsApp Manager); acá sólo se elige
// cuál mandar (Configuración → NISSI → Plantillas).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER') && !(await roleHasModule(payload.orgId, payload.role, 'conversaciones'))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }
    if (!(await canReplyToConversations(payload.orgId, payload.role))) {
      return NextResponse.json({ error: 'Tu rol puede ver la bandeja pero no responder.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const templateName = typeof body.templateName === 'string' ? body.templateName.trim() : ''
    if (!templateName) return NextResponse.json({ error: 'Falta elegir una plantilla' }, { status: 400 })

    const db = prisma as any
    const conv = await db.whatsAppConversation.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true, customerPhone: true, customerName: true },
    })
    if (!conv) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })

    const raw = await getPluginConfig(payload.orgId, 'whatsapp-ai-bot')
    const config = parseWhatsAppBotConfig(raw)
    if (!config) return NextResponse.json({ error: 'WhatsApp no está configurado' }, { status: 409 })

    const template = config.templates.find((t) => t.name === templateName)
    if (!template) return NextResponse.json({ error: 'Esa plantilla no está cargada en Configuración → NISSI' }, { status: 400 })

    const clienteNombre = conv.customerName?.trim() || 'de nuevo'
    const sent = await sendWhatsAppTemplate(config.apiToken, config.phoneNumberId, conv.customerPhone, template.name, template.language, [clienteNombre])
    if (!sent.ok) {
      return NextResponse.json({ error: sent.error || 'WhatsApp rechazó el envío' }, { status: 502 })
    }

    const now = new Date()
    // Contenido legible para el transcript — la plantilla real que ve el
    // cliente la arma Meta con el texto aprobado, esto es sólo el registro
    // interno (mismo criterio que el resto de los mensajes salientes).
    const content = `[Plantilla "${template.label}"] Hola ${clienteNombre}, soy de ${config.businessName ?? 'Abba'}. Vimos tu consulta y queríamos retomar contacto. Respondé este mensaje cuando puedas y seguimos.`
    const [created] = await Promise.all([
      db.whatsAppMessage.create({
        data: {
          conversationId: conv.id, organizationId: payload.orgId, role: 'assistant', content,
          senderUserId: payload.userId, processedAt: now, deliveryStatus: 'sent', waMessageId: sent.messageId ?? null,
        },
        select: { id: true, createdAt: true },
      }),
      db.whatsAppConversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: now, followUpSentAt: null, humanTakeoverAt: now, assignedUserId: payload.userId },
      }),
    ])

    return NextResponse.json({
      ok: true,
      message: { id: created.id, role: 'assistant', content, createdAt: created.createdAt, author: 'vos', fromHuman: true, deliveryStatus: 'sent' },
    })
  } catch (error) {
    console.error('[CONVERSACION REABRIR]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
