import { prisma } from '@/lib/db'

// Búsqueda del catálogo del proveedor (Product.sku != null) — la lógica del
// `where` estaba inline en GET /api/catalogo/products; se extrajo acá para
// poder reusarla desde la herramienta `buscar_catalogo` de NISSI
// (src/lib/whatsapp-bot/tools.ts) sin duplicar el armado de filtros ni la
// resolución del árbol de categorías.

export interface CatalogoSearchOpts {
  q?: string | null
  /** id de categoría (raíz o hoja) O nombre de categoría (match parcial). */
  categoria?: string | null
  /** true = `categoria` es un id exacto (viene de la UI). Si no matchea, se
   *  filtra por ese id igual (0 resultados) en vez de ignorar el filtro. */
  categoriaExactId?: boolean
  brand?: string | null
  /** 'active' (default) | 'inactive' | 'all' */
  status?: 'active' | 'inactive' | 'all'
  /** GREMIO: fuerza active + price > 0. */
  gremio?: boolean
  page?: number
  limit?: number
  withCount?: boolean
}

export interface CatalogoSearchResult {
  data: any[]
  total: number
  page: number
  limit: number
  totalPages: number
}

async function resolveCategoriaFilter(orgId: string, categoria: string, exactId: boolean): Promise<unknown | null> {
  const db = prisma as any
  const raw = categoria.trim()
  if (!raw) return null

  // 1) ¿es un id de categoría existente? (raíz -> incluir hijos; hoja -> ella sola)
  const asId = await db.productCategory.findFirst({
    where: { organizationId: orgId, id: raw },
    select: { id: true },
  })
  if (asId) {
    const children = await db.productCategory.findMany({
      where: { parentId: raw },
      select: { id: true },
    })
    return children.length > 0 ? { in: [raw, ...children.map((c: any) => c.id)] } : raw
  }

  // Vino como id exacto de la UI y no existe (categoría borrada, caché vieja,
  // otra org) → filtrar por ese id igual = 0 resultados (comportamiento
  // original de la ruta, NO devolver el catálogo entero).
  if (exactId) return raw

  // 2) match por nombre (parcial, insensitive) — puede matchear varias
  //    categorías (ej. "camaras" -> "CAMARAS IP WIFI", "CAMARAS ANALOGICAS")
  const byName = await db.productCategory.findMany({
    where: { organizationId: orgId, name: { contains: raw, mode: 'insensitive' } },
    select: { id: true },
  })
  if (byName.length === 0) return null
  const ids = byName.map((c: any) => c.id)
  // sumar los hijos de cada match (los productos cuelgan de la hoja)
  const children = await db.productCategory.findMany({
    where: { parentId: { in: ids } },
    select: { id: true },
  })
  return { in: [...ids, ...children.map((c: any) => c.id)] }
}

export async function searchCatalogo(orgId: string, opts: CatalogoSearchOpts): Promise<CatalogoSearchResult> {
  const db = prisma as any
  const q = (opts.q ?? '').trim()
  const status = opts.status ?? 'active'
  const page = Math.max(1, opts.page ?? 1)
  const limit = Math.min(100, Math.max(1, opts.limit ?? 24))
  const skip = (page - 1) * limit
  const withCount = opts.withCount !== false

  const where: Record<string, unknown> = {
    organizationId: orgId,
    sku: { not: null },
    ...(opts.gremio || status === 'active'
      ? { active: true }
      : status === 'inactive'
        ? { active: false }
        : {}),
  }
  if (opts.gremio) where.price = { gt: 0 }
  if (opts.categoria) {
    const catFilter = await resolveCategoriaFilter(orgId, opts.categoria, opts.categoriaExactId === true)
    if (catFilter) where.categoryId = catFilter
  }
  if (opts.brand) where.brand = opts.brand
  if (q.length >= 2) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { sku: { contains: q, mode: 'insensitive' } },
      { brand: { contains: q, mode: 'insensitive' } },
      { mpn: { contains: q, mode: 'insensitive' } },
    ]
  }

  const [data, total] = await Promise.all([
    db.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      include: { category: { select: { id: true, name: true, parentId: true } } },
    }),
    withCount ? db.product.count({ where }) : Promise.resolve(null),
  ])

  const totalCount = total ?? skip + data.length
  return { data, total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) }
}

// ─── Wrapper para NISSI: SIN precios ──────────────────────────────────────
// La herramienta buscar_catalogo NUNCA le pasa precios al modelo (NISSI no
// cotiza). Devuelve sólo lo necesario para explicar y orientar.
export interface CatalogoResultParaBot {
  nombre: string
  marca: string | null
  categoria: string | null
  modelo: string | null
  resumen: string | null
  disponibilidad: string
}

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

export async function buscarCatalogoParaBot(
  orgId: string,
  args: { query: string; categoria?: string | null },
): Promise<CatalogoResultParaBot[]> {
  const raw = args.query.trim()
  if (raw.length < 2) return []

  // ILIKE de Postgres NO pliega acentos y el catálogo de Abba los tiene
  // ("CÁMARA"). Se prueban queries distintas (tal cual → sin acentos →
  // palabra más larga), deduplicadas. La categoría se resuelve UNA sola vez
  // (sólo en el primer intento) para no repetir el par de queries de
  // resolveCategoriaFilter en cada vuelta.
  const noAccents = stripAccents(raw)
  const longestWord = noAccents.split(/\s+/).filter((w) => w.length >= 4).sort((a, b) => b.length - a.length)[0]
  const queries = Array.from(new Set([raw, noAccents, longestWord].filter((q): q is string => !!q && q.length >= 2)))

  let data: any[] = []
  for (let i = 0; i < queries.length; i++) {
    const res = await searchCatalogo(orgId, {
      q: queries[i],
      categoria: i === 0 ? args.categoria ?? null : null,
      status: 'active', limit: 8, withCount: false,
    })
    if (res.data.length) { data = res.data; break }
  }

  return data.map((p: any): CatalogoResultParaBot => ({
    nombre: p.name,
    marca: p.brand ?? null,
    categoria: p.category?.name ?? null,
    modelo: p.mpn ?? null,
    resumen: typeof p.description === 'string' && p.description
      ? p.description.slice(0, 160)
      : null,
    disponibilidad: typeof p.supplierAvailability === 'string' && p.supplierAvailability
      ? p.supplierAvailability
      : p.active ? 'consultar' : 'no disponible',
  }))
}
