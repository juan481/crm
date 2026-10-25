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
