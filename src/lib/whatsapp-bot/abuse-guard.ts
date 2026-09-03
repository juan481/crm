// Freno barato ANTES de llamar a Gemini, para no gastar tokens con alguien
// que manda puntos, letras sueltas o repite lo mismo sólo para abusar.
// Conservador a propósito: ante la duda deja pasar (que conteste NISSI).
// Sólo frena lo CLARAMENTE de relleno. Ver engine.ts para cómo se usa
// (una única respuesta de aviso por conversación, después silencio).

export interface AbuseVerdict {
  abusive: boolean
  reason: string
}

const OK: AbuseVerdict = { abusive: false, reason: '' }

// "palabra real": 3+ letras seguidas (con acentos / ñ)
const HAS_WORD = /[a-záéíóúüñ]{3,}/i

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * @param turnText   texto del turno del cliente (todos los mensajes sin
 *                    procesar de este turno, ya concatenados)
 * @param priorUserTexts  los textos de los últimos turnos del cliente que YA
 *                    fueron respondidos (más nuevo primero), para detectar
 *                    repetición
 */
export function looksAbusive(turnText: string, priorUserTexts: string[]): AbuseVerdict {
  const t = turnText.trim()
  if (!t) return { abusive: true, reason: 'mensaje vacío' }

  const compact = t.replace(/\s+/g, '')

  // 1) Ni una letra ni un dígito — sólo signos: "....", "??", "!!!", "—"
  if (!/[a-z0-9áéíóúüñ]/i.test(t)) {
    return { abusive: true, reason: 'sólo signos de puntuación' }
  }

  // 2) Un solo caracter repetido 5+ veces: "aaaaa", "jjjjjj", "......"
  if (/^(.)\1{4,}$/.test(compact)) {
    return { abusive: true, reason: 'un caracter repetido' }
  }

  // 3) 8+ caracteres con 2 o menos distintos: "ababababab", "a a a a a"
  if (compact.length >= 8 && new Set(compact.toLowerCase()).size <= 2) {
    return { abusive: true, reason: 'muy pocos caracteres distintos' }
  }

  // 4) 10+ caracteres y ni una palabra real: "k j h g f d s a q w", "1 2 3 4 5 6"
  if (compact.length >= 10 && !HAS_WORD.test(t)) {
    return { abusive: true, reason: 'sin palabras, sólo caracteres sueltos' }
  }

  // 5) Repite (casi) igual lo que ya mandó y ya le contestaron, 2+ veces
  const nt = normalize(t)
  if (nt.length <= 60) {
    const repeats = priorUserTexts.filter((p) => normalize(p) === nt).length
    if (repeats >= 2) return { abusive: true, reason: 'repite el mismo mensaje' }
  }

  return OK
}

// Techos de operación por conversación (protección de costo, independiente
// del detector de arriba). Si NISSI ya contestó demasiado en poco tiempo,
// algo raro pasa (loop, abuso, o quedó trabada) -> avisar y callarse.
export const ABUSE_MAX_REPLIES_PER_HOUR = 25
export const ABUSE_MAX_REPLIES_PER_DAY = 60
