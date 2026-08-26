import { prisma } from '@/lib/db'
import { argentinaDayStart } from '@/lib/timezone'

// "Asignar a un técnico libre si se puede (libre y de turno, o sea
// fichado)" — regla textual de Abba para el ticket de soporte que arma
// NISSI. Dos criterios, en este orden de preferencia, nunca bloqueantes
// entre sí (mejor asignar a alguien que a nadie):
//
// 1. Fichado hoy (Asistencia.horaEntrada seteada y sin horaSalida todavía)
//    — mismo criterio que usa el resto del CRM para "en jornada" (ver
//    attendance-widget). Si NADIE está fichado, se cae a considerar a
//    todos los técnicos de la org (mejor asignarle a alguien fuera de
//    horario que dejar el ticket sin asignar).
// 2. Entre los candidatos del paso 1, el que tenga MENOS tickets abiertos
//    asignados en este momento ("libre" = menor carga actual).
export async function pickAvailableTechnician(orgId: string): Promise<{ id: string; name: string; email: string } | null> {
  const db = prisma as any
  const today = argentinaDayStart()

  const clockedIn = await db.asistencia.findMany({
    where: { organizationId: orgId, fecha: today, horaEntrada: { not: null }, horaSalida: null },
    select: { userId: true },
  })
  const clockedInIds: string[] = clockedIn.map((a: { userId: string }) => a.userId)

  const baseWhere = { organizationId: orgId, role: 'TECHNICIAN', status: { not: 'DELETED' } }
  let candidates: { id: string; name: string; email: string }[] = await db.user.findMany({
    where: clockedInIds.length ? { ...baseWhere, id: { in: clockedInIds } } : baseWhere,
    select: { id: true, name: true, email: true },
  })

  // Nadie fichado ahora mismo — mejor asignarle a cualquier técnico de la
  // org que dejar el ticket sin nadie encima.
  if (!candidates.length) {
    candidates = await db.user.findMany({ where: baseWhere, select: { id: true, name: true, email: true } })
  }
  if (!candidates.length) return null

  const withLoad = await Promise.all(
    candidates.map(async (t) => ({
      t,
      openCount: await db.ticket.count({
        where: { organizationId: orgId, assignedToId: t.id, status: { notIn: ['RESUELTO', 'CERRADO'] } },
      }),
    })),
  )
  withLoad.sort((a, b) => a.openCount - b.openCount)
  return withLoad[0].t
}

// Movida a src/lib/users.ts (genérica, la usa también el portal Gremio del
// Módulo 3) — reexportada acá para no romper este import ya existente en
// tools.ts.
export { findUserByEmail } from '@/lib/users'
