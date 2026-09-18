import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canReplyToConversations } from '@/lib/whatsapp-bot/permissions'

export const dynamic = 'force-dynamic'

// Vinculación manual de una conversación de WhatsApp — el botón "Asignar a
// empresa/contacto" del inbox. Cubre lo que NISSI no pudo resolver sola
// (nunca juntó un nombre real) y el historial importado sin match
// automático. La creación de contacto/empresa nuevos NO vive acá — el
// modal del inbox la hace contra POST /api/contactos y /api/empresas (que
// ya existen y ya validan todo) y después llama acá con el id que devuelven.
//
// body: { contactoId: string } — vincula esa persona Y, si tiene empresa
//         cargada, también esa empresa (denormalizado, para no depender de
//         un join extra al listar el inbox).
//       { empresaId: string } — vincula sólo la empresa (charla B2B sin una
//         persona puntual todavía) y limpia el contacto si había uno.
//       {} — desvincula los dos.
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
    const empresaIdRaw = typeof body.empresaId === 'string' && body.empresaId.trim() ? body.empresaId.trim() : null

    const db = prisma as any
    const conv = await db.whatsAppConversation.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true },
    })
    if (!conv) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })

    if (contactoId) {
      const contacto = await db.directorioContacto.findFirst({
        where: { id: contactoId, organizationId: payload.orgId },
        select: { id: true, firstName: true, lastName: true, empresaId: true, empresa: { select: { id: true, name: true } } },
      })
      if (!contacto) return NextResponse.json({ error: 'Contacto no encontrado en esta organización' }, { status: 400 })
      await db.whatsAppConversation.update({
        where: { id: conv.id },
        data: { contactoId: contacto.id, empresaId: contacto.empresaId ?? null },
      })
      return NextResponse.json({ ok: true, contacto, empresa: contacto.empresa })
    }

    if (empresaIdRaw) {
      const empresa = await db.empresa.findFirst({
        where: { id: empresaIdRaw, organizationId: payload.orgId },
        select: { id: true, name: true },
      })
      if (!empresa) return NextResponse.json({ error: 'Empresa no encontrada en esta organización' }, { status: 400 })
      await db.whatsAppConversation.update({ where: { id: conv.id }, data: { contactoId: null, empresaId: empresa.id } })
      return NextResponse.json({ ok: true, contacto: null, empresa })
    }

    await db.whatsAppConversation.update({ where: { id: conv.id }, data: { contactoId: null, empresaId: null } })
    return NextResponse.json({ ok: true, contacto: null, empresa: null })
  } catch (error) {
    console.error('[CONVERSACION CONTACTO]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
