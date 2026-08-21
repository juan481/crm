import type { QueryClient } from '@tanstack/react-query'

// Todas las queryKeys que dependen del estado de fichaje/turnos. Bug real
// encontrado en auditoría: cada una de las 5 pantallas que pueden crear/
// editar/cerrar un bloque (widget del header, Mi Día, Mi Asistencia, RRHH
// y el panel de Turnos) sólo invalidaba el subconjunto que ESA pantalla
// usa directamente — así, ficharte desde Mi Día podía dejar el widget del
// header o Mi Asistencia mostrando datos viejos hasta que venciera su
// staleTime (hasta 30s). Usar invalidateFichaje(qc) en cualquier acción
// que toque un TurnoAsistencia o la fila mirror de Asistencia, en vez de
// invalidar sólo las queryKeys que esa pantalla en particular consume.
export const FICHAJE_QUERY_KEYS = [
  'asistencia-hoy', 'turnos-hoy', 'mi-asistencia', 'asistencia-rrhh', 'turnos-asistencia',
] as const

export function invalidateFichaje(qc: QueryClient): void {
  for (const key of FICHAJE_QUERY_KEYS) qc.invalidateQueries({ queryKey: [key] })
}
