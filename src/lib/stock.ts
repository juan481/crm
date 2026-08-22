// Lista curada de tipos de movimiento de stock — string en vez de enum de
// Prisma, mismo criterio que ETIQUETAS_TURNO (src/lib/asistencia-turnos.ts)
// y CONDICIONES_IVA (src/lib/fiscal.ts): un admin puede necesitar ajustar
// esta lista sin pedir una migración.
export const TIPOS_MOVIMIENTO_STOCK = ['Entrada', 'Salida', 'Ajuste'] as const
export type TipoMovimientoStock = (typeof TIPOS_MOVIMIENTO_STOCK)[number]

export function isValidTipoMovimiento(v: unknown): v is TipoMovimientoStock {
  return typeof v === 'string' && (TIPOS_MOVIMIENTO_STOCK as readonly string[]).includes(v)
}

// 'Salida' y 'Ajuste' negativo restan del stock actual; 'Entrada' y 'Ajuste'
// positivo suman. El signo real de un 'Ajuste' lo decide quien carga el
// movimiento (puede ser para corregir un conteo hacia arriba o hacia abajo)
// — por eso Ajuste acepta un signo explícito en vez de asumir uno solo.
export function nextStock(current: number, tipo: TipoMovimientoStock, cantidad: number, signoAjuste?: 1 | -1): number {
  if (tipo === 'Entrada') return current + cantidad
  if (tipo === 'Salida') return current - cantidad
  return current + cantidad * (signoAjuste ?? 1)
}
