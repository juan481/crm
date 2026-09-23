import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { roleHasModule } from '@/lib/module-access'
import { canReplyToConversations } from '@/lib/whatsapp-bot/permissions'

export const dynamic = 'force-dynamic'

// Argentina es UTC-3 fijo (mismo criterio que src/lib/timezone.ts) — se
// formatea a mano acá en vez de traer una lib de fechas sólo para esto.
function formatArg(d: Date): string {
  const arg = new Date(d.getTime() - 3 * 60 * 60 * 1000)
  const dd = String(arg.getUTCDate()).padStart(2, '0')
  const mm = String(arg.getUTCMonth() + 1).padStart(2, '0')
  const hh = String(arg.getUTCHours()).padStart(2, '0')
  const min = String(arg.getUTCMinutes()).padStart(2, '0')
  return `${dd}/${mm} ${hh}:${min}`
}

// Derivar una conversación tomada por un humano a OTRO agente, con
// trazabilidad — deja un divisor (role='system', mismo mecanismo que el
// import de historial) con quién se la pasó a quién y cuándo, visible en
// el hilo. body: { toUserId: string }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER') && !(await roleHasModule(payload.orgId, payload.role, 'conversaciones'))) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    if (!(await canReplyToConversations(payload.orgId, payload.role))) {
      return NextResponse.json({ error: 'Tu rol puede ver la bandeja pero no derivar conversaciones. Pedile a un administrador que lo habilite en Configuración → NISSI.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const toUserId = typeof body.toUserId === 'string' ? body.toUserId.trim() : ''
    if (!toUserId) return NextResponse.json({ error: 'Falta a quién derivar' }, { status: 400 })

    const db = prisma as any
    const [conv, toUser, fromUser] = await Promise.all([
      db.whatsAppConversation.findFirst({
        where: { id: params.id, organizationId: payload.orgId },
        select: { id: true },
      }),
      db.user.findFirst({
        where: { id: toUserId, organizationId: payload.orgId, status: 'ACTIVE' },
        select: { id: true, name: true },
      }),
      db.user.findUnique({ where: { id: payload.userId }, select: { name: true } }),
    ])
    if (!conv) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    if (!toUser) return NextResponse.json({ error: 'Usuario no encontrado en esta organización' }, { status: 400 })
    if (toUser.id === payload.userId) return NextResponse.json({ error: 'Ya la tenés vos' }, { status: 400 })

    const now = new Date()
    const auditText = `── ${fromUser?.name ?? 'Alguien'} transfirió la conversación a ${toUser.name} — ${formatArg(now)} ──`

    await Promise.all([
      // humanTakeoverAt se refresca (no se libera) — sigue en manos de un
      // humano, sólo cambia cuál. Misma auto-liberación de 24hs que ya rige
      // cualquier toma humana (ver engine.ts).
      db.whatsAppConversation.update({
        where: { id: conv.id },
        data: { humanTakeoverAt: now, assignedUserId: toUser.id },
      }),
      db.whatsAppMessage.create({
        data: { conversationId: conv.id, organizationId: payload.orgId, role: 'system', content: auditText, createdAt: now },
      }),
    ])

    return NextResponse.json({ ok: true, assignedUser: toUser })
  } catch (error) {
    console.error('[CONVERSACION DERIVAR]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
