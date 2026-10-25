// Fechas de la agenda de contacto (deal-agenda.tsx y la tarjeta del
// Pipeline) — todo sobre claves "YYYY-MM-DD", sin pasar por la timezone del
// navegador (ver src/lib/timezone.ts).

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export function sumarDiasDateKey(dateKey: string, dias: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10)
}

/** "Hoy" / "Mañana" / "Jueves 30/10" (esta semana) / "05/11". */
export function etiquetaDiaAgenda(dia: string, hoy: string): string {
  if (dia === hoy) return 'Hoy'
  if (dia === sumarDiasDateKey(hoy, 1)) return 'Mañana'
  const [y, m, d] = dia.split('-').map(Number)
  const dd = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
  if (dia > hoy && dia <= sumarDiasDateKey(hoy, 6)) {
    const nombre = DIAS_SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
    return `${nombre[0].toUpperCase()}${nombre.slice(1)} ${dd}`
  }
  return dd
}
