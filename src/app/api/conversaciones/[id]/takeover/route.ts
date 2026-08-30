import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Tomar la conversación (sin responder todavía) o devolvérsela a NISSI.
// POST body: { active: boolean }  — true = tomar, false = devolver a NISSI.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const active = body.active !== false // default: tomar

    const db = prisma as any
    const conv = await db.whatsAppConversation.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true },
    })
    if (!conv) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })

    await db.whatsAppConversation.update({
      where: { id: conv.id },
      data: active
        ? { humanTakeoverAt: new Date(), assignedUserId: payload.userId }
        : { humanTakeoverAt: null, assignedUserId: null },
    })

    return NextResponse.json({ ok: true, humanHandling: active })
  } catch (error) {
    console.error('[CONVERSACION TAKEOVER]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
