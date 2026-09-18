import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canReplyToConversations } from '@/lib/whatsapp-bot/permissions'

export const dynamic = 'force-dynamic'

// Vinculación manual de una conversación de WhatsApp a un contacto del
// directorio — el botón "Asignar a empresa/contacto" del inbox. Cubre lo
// que NISSI no pudo resolver sola (nunca juntó un nombre real) y el
// historial importado sin match automático. body: { contactoId: string | null }
// (null = desvincular).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    if (!(await canReplyToConversations(payload.orgId, payload.role))) {
      return NextResponse.json({ error: 'Tu rol puede ver la bandeja pero no editarla. Pedile a un administrador que lo habilite en Configuración → NISSI.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const contactoId = typeof body.contactoId === 'string' && body.contactoId.trim() ? body.contactoId.trim() : null

    const db = prisma as any
    const conv = await db.whatsAppConversation.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true },
    })
    if (!conv) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })

    if (contactoId) {
      const contacto = await db.directorioContacto.findFirst({
        where: { id: contactoId, organizationId: payload.orgId },
        select: { id: true, firstName: true, lastName: true, empresa: { select: { id: true, name: true } } },
      })
      if (!contacto) return NextResponse.json({ error: 'Contacto no encontrado en esta organización' }, { status: 400 })
      await db.whatsAppConversation.update({ where: { id: conv.id }, data: { contactoId } })
      return NextResponse.json({ ok: true, contacto })
    }

    await db.whatsAppConversation.update({ where: { id: conv.id }, data: { contactoId: null } })
    return NextResponse.json({ ok: true, contacto: null })
  } catch (error) {
    console.error('[CONVERSACION CONTACTO]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
