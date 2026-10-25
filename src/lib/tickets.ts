// Horas de SLA por prioridad — el reloj arranca al crear el ticket y se
// recalcula si la prioridad cambia mientras sigue abierto.
export const SLA_HOURS: Record<string, number> = { URGENTE: 4, ALTA: 8, MEDIA: 24, BAJA: 72 }

// Un ticket que sigue ABIERTO (nadie lo pasó a "En proceso") pasadas estas
// horas cuenta como "sin atender": aviso diario en la campanita y por mail a
// quien lo tiene (ver /api/notifications y /api/cron/tickets-sin-atender).
// Pedido de Abba (Seba, 25/10).
export const TICKET_SIN_ATENDER_HORAS = 24
