import { NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { roleHasModule } from '@/lib/module-access'
import { unstable_cache } from 'next/cache'
import { puedeVerServicios } from '@/lib/finance-access'
import { argentinaDayStart, argentinaTimeToInstant, fmtDateOnly } from '@/lib/timezone'
import { DIAS_SIN_CONTACTO, ultimaActividadManual, ultimoContacto } from '@/lib/deal-contacto'

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  href: string
  severity: 'danger' | 'warning' | 'info'
  // Fecha del evento — determina si es "no leída" contra
  // User.notificationsReadAt. Los ítems sin una fecha de evento real
  // (factura vencida: es un estado, no un evento puntual) no se cuentan
  // como no-leídos — ver `countsTowardUnread` más abajo.
  createdAt: string
  countsTowardUnread: boolean
  // Sólo presente en la respuesta final al cliente (se calcula en el GET,
  // contra User.notificationsReadAt) — ausente en lo que arma fetchNotifications.
  unread?: boolean
  // Presentes sólo en los tipos que necesitan filtrarse por usuario DESPUÉS
  // de la caché compartida (ver GET) — nunca llegan al cliente.
  assigneeId?: string | null
  collaboratorIds?: string[]
}

async function fetchNotifications(orgId: string): Promise<AppNotification[]> {
  const now = new Date()
  const since72h = new Date(now.getTime() - 72 * 60 * 60 * 1000)
  const db = prisma as any

  const [overdueInvoices, newLeads, pendingTasks, newTickets, recentConvs, pendingDeletions, ajustesVencidos, dealsAbiertos] = await Promise.all([
    db.invoice.findMany({
      where: {
        organizationId: orgId,
        OR: [{ status: 'OVERDUE' }, { status: 'PENDING', dueDate: { lt: now } }],
      },
      select: { id: true, amount: true, currency: true, status: true, empresa: { select: { id: true, name: true } } },
      orderBy: { dueDate: 'asc' },
      take: 8,
    }),
    // Leads nuevos — hoy sólo entran vía NISSI (WhatsApp), preparado para
    // sumar más fuentes (Facebook Ads, formulario web, etc.) sin tocar este
    // bloque, sólo el string libre Deal.origen.
    db.deal.findMany({
      where: { organizationId: orgId, stage: 'LEAD', createdAt: { gte: since72h } },
      select: { id: true, title: true, origen: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    // Tareas pendientes/en curso — de TODA la org (se filtra "es mía o soy
    // colaborador" en el GET, después de la caché compartida).
    db.task.findMany({
      where: { organizationId: orgId, status: { in: ['PENDIENTE', 'EN_CURSO'] } },
      select: { id: true, title: true, dueDate: true, createdAt: true, assignedToId: true, collaborators: { select: { userId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    // Tickets nuevos (últimas 72h) — mismo criterio de ventana que los leads.
    db.ticket.findMany({
      where: { organizationId: orgId, status: { in: ['ABIERTO', 'EN_PROCESO'] }, createdAt: { gte: since72h } },
      select: { id: true, number: true, title: true, createdAt: true, assignedToId: true, collaborators: { select: { userId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
    // Conversaciones de WhatsApp con actividad reciente (últimas 72hs) — a
    // propósito NO es el mismo criterio que /api/notifications/counts (que
    // filtra lastReadAt < lastInboundAt: "esto necesita un HUMANO"). Ese
    // criterio queda vacío apenas NISSI contesta bien sola — que es el caso
    // normal, no la excepción — y esta campanita dejaba de avisar de
    // CUALQUIER mensaje nuevo, aunque NISSI lo haya manejado perfecto. Acá
    // el objetivo es otro: "avisame que llegó algo", separado de "esto
    // necesita que alguien entre". importedAt IS NULL: el historial migrado
    // no es actividad nueva.
    db.whatsAppConversation.findMany({
      where: { organizationId: orgId, importedAt: null, lastInboundAt: { gte: since72h } },
      select: { id: true, customerName: true, customerPhone: true, lastInboundAt: true },
      orderBy: { lastInboundAt: 'desc' },
      take: 10,
    }),
    // Maker-checker de Eliminar (pedido de Abba, Seba 2026-10-02) — ver
    // src/lib/deletion-requests.ts. Filtrado a SUPER_ADMIN más abajo, en el
    // GET (mismo criterio que overdueInvoices con canSeeFinancials).
    db.deletionRequest.findMany({
      where: { organizationId: orgId, status: 'PENDING' },
      select: { id: true, entityType: true, entityLabel: true, createdAt: true, requestedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    // Ajuste periódico de abonos (ej. trimestral por IPC) que ya tocaba —
    // pedido de Abba (Seba, 22/10): "que nos avise, che subí el abono".
    // Sigue apareciendo hasta que alguien lo aplica (eso corre la fecha).
    db.ajusteAbono.findMany({
      where: { organizationId: orgId, proximoAjuste: { lte: argentinaDayStart(now) } },
      select: { id: true, nombre: true, moneda: true, cadaMeses: true, proximoAjuste: true },
      orderBy: { proximoAjuste: 'asc' },
      take: 10,
    }),
    // Oportunidades abiertas — para "sin contacto hace +N días" (pedido de
    // Abba, Seba 25/10). Sólo las que no se tocan hace DIAS_SIN_CONTACTO
    // pueden calificar, así que el filtro grueso por updatedAt va en la query
    // y el fino (notas de actividad, cotizaciones) abajo.
    db.deal.findMany({
      where: {
        organizationId: orgId,
        stage: { notIn: ['GANADO', 'PERDIDO'] },
        updatedAt: { lt: new Date(now.getTime() - DIAS_SIN_CONTACTO * 24 * 60 * 60 * 1000) },
      },
      select: { id: true, ownerId: true, updatedAt: true, owner: { select: { name: true } } },
      take: 2000,
    }),
  ])

  // Un aviso por vendedor, no uno por oportunidad (Abba tiene decenas
  // abiertas a la vez — uno por deal tapaba la campanita).
  const manual = await ultimaActividadManual(db, dealsAbiertos.map((d: any) => d.id))
  const limite = now.getTime() - DIAS_SIN_CONTACTO * 24 * 60 * 60 * 1000
  const sinContactoPorOwner = new Map<string, { name: string; count: number }>()
  for (const d of dealsAbiertos) {
    if (ultimoContacto(d.updatedAt, manual.get(d.id)).getTime() >= limite) continue
    const row = sinContactoPorOwner.get(d.ownerId) ?? { name: d.owner?.name ?? 'Sin asignar', count: 0 }
    row.count++
    sinContactoPorOwner.set(d.ownerId, row)
  }

  const notifications: AppNotification[] = []

  for (const inv of overdueInvoices) {
    notifications.push({
      id: `inv-${inv.id}`,
      type: 'overdue_invoice',
      title: inv.status === 'OVERDUE' ? 'Factura vencida' : 'Factura pendiente',
      body: `${inv.empresa?.name ?? 'Cliente'} — ${inv.amount.toLocaleString('es')} ${inv.currency}`,
      href: '/facturas',
      severity: 'danger',
      createdAt: now.toISOString(), // es un estado, no un evento — se muestra siempre, nunca "leído"
      countsTowardUnread: false,
    })
  }

  for (const deal of newLeads) {
    notifications.push({
      id: `lead-${deal.id}`,
      type: 'new_lead',
      title: deal.origen === 'WHATSAPP' ? 'Ingresó un nuevo cliente por WhatsApp' : 'Nuevo lead',
      body: deal.title,
      href: `/pipeline?dealId=${deal.id}`,
      severity: 'info',
      createdAt: deal.createdAt.toISOString(),
      countsTowardUnread: true,
    })
  }

  for (const t of pendingTasks) {
    notifications.push({
      id: `task-${t.id}`,
      type: 'pending_task',
      title: 'Tarea pendiente',
      body: t.title,
      href: `/tareas/${t.id}`,
      severity: t.dueDate && t.dueDate < now ? 'warning' : 'info',
      createdAt: t.createdAt.toISOString(),
      countsTowardUnread: true,
      assigneeId: t.assignedToId,
      collaboratorIds: t.collaborators.map((c: { userId: string }) => c.userId),
    })
  }

  for (const t of newTickets) {
    notifications.push({
      id: `ticket-${t.id}`,
      type: 'new_ticket',
      title: `Nuevo ticket #${t.number}`,
      body: t.title,
      href: `/tickets/${t.id}`,
      severity: 'warning',
      createdAt: t.createdAt.toISOString(),
      countsTowardUnread: true,
      assigneeId: t.assignedToId,
      collaboratorIds: t.collaborators.map((c: { userId: string }) => c.userId),
    })
  }

  for (const c of recentConvs) {
    notifications.push({
      id: `wa-${c.id}`,
      type: 'whatsapp_unread',
      title: 'Mensaje de WhatsApp',
      body: c.customerName || `+${c.customerPhone}`,
      href: `/conversaciones?c=${c.id}`,
      severity: 'info',
      createdAt: new Date(c.lastInboundAt).toISOString(),
      countsTowardUnread: true,
    })
  }

  for (const d of pendingDeletions) {
    notifications.push({
      id: `del-${d.id}`,
      type: 'deletion_request',
      title: d.entityType === 'empresa' ? 'Pedido de baja: empresa' : 'Pedido de baja: contacto',
      body: `${d.entityLabel} — pedido por ${d.requestedBy?.name ?? '—'}`,
      href: '/configuracion/bajas-pendientes',
      severity: 'warning',
      createdAt: d.createdAt.toISOString(),
      countsTowardUnread: true,
    })
  }

  for (const a of ajustesVencidos) {
    const fecha = a.proximoAjuste.toISOString().slice(0, 10)
    notifications.push({
      id: `ajuste-${a.id}-${fecha}`,
      type: 'ajuste_abono',
      title: 'Toca ajustar un abono',
      body: `${a.nombre} (${a.moneda}) — ajuste ${a.cadaMeses === 3 ? 'trimestral' : `cada ${a.cadaMeses} meses`} desde el ${fmtDateOnly(fecha)}`,
      href: `/servicios?ajustar=${encodeURIComponent(`${a.nombre}::${a.moneda}`)}`,
      severity: 'warning',
      // Mediodía UTC del día que tocaba — "no leída" una vez por fecha.
      createdAt: `${fecha}T12:00:00.000Z`,
      countsTowardUnread: true,
    })
  }

  // Fecha del evento = inicio del día argentino → vuelve a figurar como "no
  // leída" una vez por día mientras siga habiendo oportunidades sin contacto.
  const hoy = argentinaTimeToInstant(argentinaDayStart(now), 0, 0).toISOString()
  for (const [ownerId, r] of Array.from(sinContactoPorOwner)) {
    notifications.push({
      id: `sincontacto-${ownerId}-${hoy.slice(0, 10)}`,
      type: 'deals_sin_contacto',
      title: `${r.count} oportunidad${r.count !== 1 ? 'es' : ''} sin contacto`,
      body: `${r.name} — hace más de ${DIAS_SIN_CONTACTO} días que nadie las contacta`,
      href: `/pipeline?sinContacto=1&owner=${ownerId}`,
      severity: 'warning',
      createdAt: hoy,
      countsTowardUnread: true,
      assigneeId: ownerId,
    })
  }

  return notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

// Cache per-org for 20s — corto a propósito: alimenta la campanita del
// header (polling) y el sonido de alerta; antes eran 10 min, invisible para
// algo que se supone avisa "en el momento". No es tiempo real de verdad (no
// hay websockets en el proyecto) pero es lo más cerca que se puede llegar
// sin sumar esa infraestructura.
const getCachedNotifications = unstable_cache(
  fetchNotifications,
  ['notifications'],
  { revalidate: 20 }
)

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const [all, me] = await Promise.all([
      getCachedNotifications(payload.orgId),
      prisma.user.findUnique({ where: { id: payload.userId }, select: { notificationsReadAt: true } }),
    ])

    // Facturación es ADMIN+, leads son SELLER+ — la caché es por
    // organización, no por rol/usuario, así que el filtro va acá, después de
    // leerla. WhatsApp: SELLER+ por default, pero RRHH/Técnicos pueden ganar
    // el módulo desde Configuración → Permisos (mismo criterio que el ítem
    // del sidebar y las APIs de /api/conversaciones/*). Tareas/tickets:
    // todos + "involucra a este usuario" (asignado o colaborador) salvo
    // ADMIN+, que ve las de toda la org (necesita panorama completo, no
    // sólo lo propio).
    const canSeeFinancials = canAccess(payload.role, 'ADMIN')
    const canSeeLeads = canAccess(payload.role, 'SELLER')
    const canSeeWhatsapp = canAccess(payload.role, 'SELLER') || (await roleHasModule(payload.orgId, payload.role, 'conversaciones'))
    const isAdmin = canAccess(payload.role, 'ADMIN')
    const canSeeServicios = all.some((n) => n.type === 'ajuste_abono') && (await puedeVerServicios(payload.orgId, payload.role))
    const involvesMe = (n: AppNotification) =>
      isAdmin || n.assigneeId === payload.userId || !!n.collaboratorIds?.includes(payload.userId)

    const readAt = me?.notificationsReadAt ?? null
    const data = all
      .filter((n) => {
        if (n.type === 'overdue_invoice') return canSeeFinancials
        if (n.type === 'new_lead') return canSeeLeads
        if (n.type === 'whatsapp_unread') return canSeeWhatsapp
        if (n.type === 'pending_task' || n.type === 'new_ticket') return involvesMe(n)
        if (n.type === 'deletion_request') return payload.role === 'SUPER_ADMIN'
        if (n.type === 'ajuste_abono') return canSeeServicios
        // El vendedor ve el suyo; Admin+ ve el de cada uno (involvesMe).
        if (n.type === 'deals_sin_contacto') return canSeeLeads && involvesMe(n)
        return true
      })
      .map(({ assigneeId: _assigneeId, collaboratorIds: _collaboratorIds, ...n }) => ({
        ...n,
        unread: n.countsTowardUnread && (!readAt || new Date(n.createdAt) > readAt),
      }))

    return NextResponse.json(
      { data },
      { headers: { 'Cache-Control': 'private, no-store' } }, // por-usuario (unread) — no cachear en el edge
    )
  } catch (error) {
    console.error('[NOTIFICATIONS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST() {
  // "Marcar todo como leído" — un solo timestamp por usuario, no hace falta
  // trackear ítem por ítem (el feed es de corto plazo, 72hs de ventana en
  // leads/tickets, tareas pendientes reales).
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    await prisma.user.update({ where: { id: payload.userId }, data: { notificationsReadAt: new Date() } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[NOTIFICATIONS MARK READ]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
