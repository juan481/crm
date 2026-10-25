// "¿Hace cuánto que nadie contacta a este cliente?" — pedido de Abba (Seba,
// 25/10): alertar cuando una oportunidad abierta pasa 5 días sin contacto.
// Antes el tablero usaba sólo Deal.updatedAt (14 días), y cargar una
// llamada/nota en la Actividad NO lo movía: un vendedor que llamaba ayer
// seguía viendo "17 días sin actividad".
//
// Último contacto = lo más nuevo entre:
//  - Deal.updatedAt (cambio de etapa, monto, responsable…)
//  - la última nota de Actividad CARGADA POR UNA PERSONA (las automáticas de
//    NISSI — transcript al derivar, mensaje del cliente después de derivar —
//    llevan metadata NOTA_AUTOMATICA y no cuentan: que el cliente escriba no
//    es que lo hayamos contactado)
//  - la última cotización de la oportunidad
//
// Sin imports de servidor a propósito (recibe `db`): las constantes las usa
// también el tablero del Pipeline, que es client component.

export const DIAS_SIN_CONTACTO = 5

// Marca en DealNota.metadata de las notas que escribe el sistema, no una persona.
export const NOTA_AUTOMATICA_META = JSON.stringify({ auto: true })

const DAY_MS = 24 * 60 * 60 * 1000

export function diasDesde(iso: string | Date, now: number = Date.now()): number {
  return Math.floor((now - new Date(iso).getTime()) / DAY_MS)
}

/** Último contacto real de cada deal (ver arriba). Devuelve sólo los ids que
 *  tienen nota o cotización — el llamador hace max() contra updatedAt. */
export async function ultimaActividadManual(db: any, dealIds: string[]): Promise<Map<string, Date>> {
  const out = new Map<string, Date>()
  if (dealIds.length === 0) return out
  const [notas, cotis] = await Promise.all([
    db.dealNota.groupBy({
      by: ['dealId'],
      where: {
        dealId: { in: dealIds },
        // metadata null = nota de una persona; si tiene metadata (ej. una
        // imagen adjunta) igual cuenta, salvo que sea la marca automática.
        OR: [{ metadata: null }, { NOT: { metadata: { contains: '"auto":true' } } }],
      },
      _max: { createdAt: true },
    }),
    db.cotizacion.groupBy({
      by: ['dealId'],
      where: { dealId: { in: dealIds } },
      _max: { createdAt: true },
    }),
  ])
  for (const r of [...notas, ...cotis]) {
    const d: Date | null = r._max?.createdAt ?? null
    if (!r.dealId || !d) continue
    const prev = out.get(r.dealId)
    if (!prev || d > prev) out.set(r.dealId, d)
  }
  return out
}

export function ultimoContacto(updatedAt: Date, manual: Date | undefined): Date {
  return manual && manual > updatedAt ? manual : updatedAt
}

// ── Agenda de contacto ───────────────────────────────────────────────────
// Pedido de Abba (Seba, 25/10): "Sebastián contacta y se pone una agenda
// para dentro de 3 días; a los tres días le aparece que tiene que contactar
// a Juan". Una agenda es una Task pendiente con dealId y fecha — así además
// cae sola en Tareas, en Mi Día y en el mail diario de task-reminders, sin
// otro modelo. La fecha se guarda a mediodía UTC (dateOnlyArgentina) para
// que el día no se corra en el navegador.

export interface ProximaAgenda { id: string; title: string; description: string | null; dia: string /* YYYY-MM-DD */ }

/** Día "YYYY-MM-DD" de un Task.dueDate. Las agendas se guardan a mediodía
 *  UTC y las tareas viejas a medianoche UTC del día elegido — en los dos
 *  casos el día correcto es el de la fecha UTC. */
export function diaDeAgenda(dueDate: Date | string): string {
  return new Date(dueDate).toISOString().slice(0, 10)
}

/** La agenda pendiente más próxima de cada deal (la más vieja primero, así
 *  una vencida no queda tapada por una futura). */
export async function proximasAgendas(db: any, dealIds: string[]): Promise<Map<string, ProximaAgenda>> {
  const out = new Map<string, ProximaAgenda>()
  if (dealIds.length === 0) return out
  const tasks = await db.task.findMany({
    where: { dealId: { in: dealIds }, status: { in: ['PENDIENTE', 'EN_CURSO'] }, dueDate: { not: null } },
    orderBy: { dueDate: 'asc' },
    select: { id: true, title: true, description: true, dueDate: true, dealId: true },
  })
  for (const t of tasks) {
    if (!out.has(t.dealId)) out.set(t.dealId, { id: t.id, title: t.title, description: t.description, dia: diaDeAgenda(t.dueDate) })
  }
  return out
}

/** Una oportunidad con un contacto agendado para hoy o más adelante NO está
 *  "sin contacto" — el vendedor ya sabe cuándo la vuelve a tocar. */
export function tieneAgendaVigente(agenda: { dia: string } | null | undefined, hoyKey: string): boolean {
  return !!agenda && agenda.dia >= hoyKey
}
