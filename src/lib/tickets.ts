// Horas de SLA por prioridad — el reloj arranca al crear el ticket y se
// recalcula si la prioridad cambia mientras sigue abierto.
export const SLA_HOURS: Record<string, number> = { URGENTE: 4, ALTA: 8, MEDIA: 24, BAJA: 72 }
