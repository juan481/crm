import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Estadísticas del inbox de WhatsApp / NISSI, para la vista "Estadísticas"
// de /conversaciones. Todo scopeado a la organización del usuario.
export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const orgId = payload.orgId
    const days = Math.min(180, Math.max(7, Number(req.nextUrl.searchParams.get('days') ?? 30)))
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const db = prisma as any
    const convWhere = { organizationId: orgId }
    // organizationId está denormalizado en WhatsAppMessage (índice
    // [organizationId, createdAt]) — se filtra directo, sin join a la
    // conversación. `organizationId: null` = mensajes anteriores al backfill.
    const msgWhere = (extra: Record<string, unknown> = {}) => ({
      organizationId: orgId,
      createdAt: { gte: since },
      ...extra,
    })

    const [
      total, activasNissi, conHumano, derivadas, cerradas,
      nuevas, derivadasPeriodo, tomadasPeriodo, resueltasNissiPeriodo, conversacionesActivasPeriodo,
      msgEntrantes, msgNissi, msgHumanos, msgFallidos,
      handoffGroups, leadGroups, sinLeerRaw, porDia,
    ] = await Promise.all([
      db.whatsAppConversation.count({ where: convWhere }),
      db.whatsAppConversation.count({ where: { ...convWhere, status: 'ACTIVE', humanTakeoverAt: null } }),
      db.whatsAppConversation.count({ where: { ...convWhere, humanTakeoverAt: { not: null } } }),
      db.whatsAppConversation.count({ where: { ...convWhere, status: 'HANDED_OFF' } }),
      db.whatsAppConversation.count({ where: { ...convWhere, status: 'CLOSED' } }),

      db.whatsAppConversation.count({ where: { ...convWhere, createdAt: { gte: since } } }),
      db.whatsAppConversation.count({ where: { ...convWhere, createdAt: { gte: since }, status: 'HANDED_OFF' } }),
      db.whatsAppConversation.count({ where: { ...convWhere, createdAt: { gte: since }, humanTakeoverAt: { not: null } } }),
      // Sigue manejándola NISSI: ni derivada ni tomada por un humano.
      db.whatsAppConversation.count({ where: { ...convWhere, createdAt: { gte: since }, status: { not: 'HANDED_OFF' }, humanTakeoverAt: null } }),
      // Conversaciones con actividad en el período (para el promedio de
      // mensajes — no sólo las creadas en el período).
      db.whatsAppConversation.count({ where: { ...convWhere, lastMessageAt: { gte: since } } }),

      db.whatsAppMessage.count({ where: msgWhere({ role: 'user' }) }),
      db.whatsAppMessage.count({ where: msgWhere({ role: 'assistant', senderUserId: null }) }),
      db.whatsAppMessage.count({ where: msgWhere({ role: 'assistant', senderUserId: { not: null } }) }),
      db.whatsAppMessage.count({ where: msgWhere({ deliveryStatus: 'failed' }) }),

      db.whatsAppConversation.groupBy({
        by: ['handedOffTo'],
        where: { ...convWhere, handedOffTo: { not: null }, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      db.deal.groupBy({
        by: ['leadReason'],
        where: { organizationId: orgId, origen: 'WHATSAPP', createdAt: { gte: since } },
        _count: { _all: true },
      }),
      db.$queryRaw`
        SELECT COUNT(*)::int AS count FROM "WhatsAppConversation"
        WHERE "organizationId" = ${orgId}
          AND "lastInboundAt" IS NOT NULL
          AND ("lastReadAt" IS NULL OR "lastReadAt" < "lastInboundAt")
      `,
      // Serie diaria de los últimos 14 días. Argentina es UTC-3 fijo (ver
      // src/lib/timezone.ts) → restar 3hs antes de ::date convierte el
      // instante UTC guardado al día calendario argentino, mismo criterio
      // que el resto del CRM.
      db.$queryRaw`
        SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
               COALESCE(c.n, 0)::int AS nuevas,
               COALESCE(m.n, 0)::int AS mensajes
        FROM generate_series(
               ((now() - INTERVAL '3 hours')::date - INTERVAL '13 days'),
               ((now() - INTERVAL '3 hours')::date),
               INTERVAL '1 day'
             ) AS d(day)
        LEFT JOIN (
          SELECT ("createdAt" - INTERVAL '3 hours')::date AS day, COUNT(*) AS n
          FROM "WhatsAppConversation"
          WHERE "organizationId" = ${orgId} AND "createdAt" >= now() - INTERVAL '15 days'
          GROUP BY 1
        ) c ON c.day = d.day::date
        LEFT JOIN (
          SELECT ("createdAt" - INTERVAL '3 hours')::date AS day, COUNT(*) AS n
          FROM "WhatsAppMessage"
          WHERE "organizationId" = ${orgId} AND "createdAt" >= now() - INTERVAL '15 days'
          GROUP BY 1
        ) m ON m.day = d.day::date
        ORDER BY d.day ASC
      `,
    ])

    const sinLeer = Number((sinLeerRaw as { count: number }[])[0]?.count ?? 0)
    const totalMsg = msgEntrantes + msgNissi + msgHumanos

    const areaMap: Record<string, number> = {}
    for (const g of handoffGroups) areaMap[g.handedOffTo ?? 'OTRO'] = g._count._all
    const leadMap: Record<string, number> = {}
    for (const g of leadGroups) leadMap[g.leadReason ?? 'sin_clasificar'] = g._count._all

    return NextResponse.json({
      data: {
        days,
        totales: { total, activasNissi, conHumano, derivadas, cerradas, sinLeer },
        periodo: {
          nuevas,
          resueltasPorNissi: resueltasNissiPeriodo,
          derivadas: derivadasPeriodo,
          tomadasPorHumano: tomadasPeriodo,
          pctNissi: nuevas ? Math.round((resueltasNissiPeriodo / nuevas) * 100) : 0,
        },
        mensajes: {
          entrantes: msgEntrantes,
          deNissi: msgNissi,
          deHumanos: msgHumanos,
          fallidos: msgFallidos,
          total: totalMsg,
          // Sobre las conversaciones que tuvieron actividad en el período, no
          // sólo las creadas en él (evita inflar el promedio con charlas
          // viejas que siguen activas).
          promedioPorConversacion: conversacionesActivasPeriodo
            ? Math.round((totalMsg / conversacionesActivasPeriodo) * 10) / 10
            : 0,
        },
        derivacionesPorArea: areaMap,
        leads: leadMap,
        porDia: porDia as { date: string; nuevas: number; mensajes: number }[],
      },
    })
  } catch (error) {
    console.error('[CONVERSACIONES STATS]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
