// Matcheo de un renglón de factura de compra a un Product del catálogo.
// Estrategia en cascada: SKU exacto → MPN exacto → solapamiento de tokens del
// nombre. Sin pg_trgm — el catálogo de Abba (~2300 SKUs) entra en memoria y
// el scoring por tokens alcanza; si hiciera falta más precisión se puede
// habilitar la extensión y usar similarity() (ver plan Fase 2).

export interface ProductoParaMatch {
  id: string
  name: string
  sku: string | null
  mpn?: string | null
  costo?: number | null
  currency?: string
  trackStock?: boolean
  stock?: number
}

export interface MatchResult {
  productId: string | null
  confianza: 'ALTA' | 'MEDIA' | 'BAJA' | 'NINGUNA'
  motivo: string
}

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

export function normalizeToken(s: string): string {
  return stripAccents((s || '').toLowerCase())
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Palabras demasiado genéricas para aportar al match.
const STOPWORDS = new Set([
  'de', 'la', 'el', 'con', 'para', 'y', 'x', 'un', 'una', 'kit', 'pack',
  'unidad', 'unidades', 'u', 'pza', 'pzas', 'art', 'cod', 'sin', 'por',
])

function tokenSet(s: string): Set<string> {
  return new Set(
    normalizeToken(s)
      .split(' ')
      .filter((t) => t.length >= 2 && !STOPWORDS.has(t)),
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  a.forEach((t) => { if (b.has(t)) inter++ })
  return inter / (a.size + b.size - inter)
}

export function matchCompraItem(
  linea: { codigo?: string | null; descripcion: string },
  productos: ProductoParaMatch[],
): MatchResult {
  const codigo = (linea.codigo ?? '').trim().toLowerCase()

  if (codigo) {
    const bySku = productos.find((p) => (p.sku ?? '').trim().toLowerCase() === codigo)
    if (bySku) return { productId: bySku.id, confianza: 'ALTA', motivo: `SKU ${bySku.sku}` }
    const byMpn = productos.find((p) => (p.mpn ?? '').trim().toLowerCase() === codigo)
    if (byMpn) return { productId: byMpn.id, confianza: 'ALTA', motivo: `Modelo ${byMpn.mpn}` }
  }

  const desc = tokenSet(linea.descripcion)
  if (desc.size === 0) return { productId: null, confianza: 'NINGUNA', motivo: 'Sin descripción para matchear' }

  let best: ProductoParaMatch | null = null
  let bestScore = 0
  for (const p of productos) {
    const score = jaccard(desc, tokenSet(p.name))
    if (score > bestScore) { bestScore = score; best = p }
  }

  if (best && bestScore >= 0.6) return { productId: best.id, confianza: 'MEDIA', motivo: `Nombre similar (${Math.round(bestScore * 100)}%)` }
  if (best && bestScore >= 0.35) return { productId: best.id, confianza: 'BAJA', motivo: `Nombre parecido (${Math.round(bestScore * 100)}%)` }
  return { productId: null, confianza: 'NINGUNA', motivo: 'Sin coincidencias — elegí el producto a mano' }
}
