import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Marca la conversación como leída (marcador a nivel org — bandeja
// compartida, equipo chico). Baja el badge del sidebar.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const res = await db.whatsAppConversation.updateMany({
      where: { id: params.id, organizationId: payload.orgId },
      data: { lastReadAt: new Date() },
    })
    if (res.count === 0) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[CONVERSACION READ]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
