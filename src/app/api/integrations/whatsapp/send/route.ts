import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { isPluginEnabled } from '@/lib/plugins'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

// Envío puntual desde la ficha de un contacto/empresa — no hay bulk acá
// (mandar WhatsApp masivo sin opt-in real es motivo de ban de Meta, fuera
// de alcance a propósito).
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    if (!(await isPluginEnabled(payload.orgId, 'whatsapp-integration'))) {
      return NextResponse.json({ error: 'El plugin de WhatsApp Business no está activado' }, { status: 400 })
    }

    const { to, message } = await req.json()
    if (!to?.trim())      return NextResponse.json({ error: 'Falta el número de destino' }, { status: 400 })
    if (!message?.trim()) return NextResponse.json({ error: 'El mensaje no puede estar vacío' }, { status: 400 })

    const result = await sendWhatsAppMessage(payload.orgId, to, message)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })

    return NextResponse.json({ message: 'Mensaje enviado' })
  } catch (error) {
    console.error('[WHATSAPP SEND API]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
