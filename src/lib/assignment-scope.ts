// Condición Prisma reutilizable: "¿este usuario tiene que ver con esta
// tarea/ticket?" — ya sea como asignado principal (assignedToId, el dueño
// de siempre) o como colaborador adicional (TaskCollaborator/
// TicketCollaborator, la posibilidad nueva de sumar más gente sin que sea
// obligatorio). Se usa en TODOS los filtros de visibilidad restringida
// (SELLER/TECHNICIAN/HR sólo ven lo suyo) y en el query param
// ?assignedToId= que ya usaba Mi Día para pedir "lo mío" — así un
// colaborador ve la tarea/ticket en su propia lista, no sólo el asignado
// principal.
export function taskInvolvesUser(userId: string) {
  return { OR: [{ assignedToId: userId }, { collaborators: { some: { userId } } }] }
}

export function ticketInvolvesUser(userId: string) {
  return { OR: [{ assignedToId: userId }, { collaborators: { some: { userId } } }] }
}
