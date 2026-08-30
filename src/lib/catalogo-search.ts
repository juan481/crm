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

async function resolveCategoriaFilter(orgId: string, categoria: string): Promise<unknown | null> {
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
    const catFilter = await resolveCategoriaFilter(orgId, opts.categoria)
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

export async function buscarCatalogoParaBot(
  orgId: string,
  args: { query: string; categoria?: string | null },
): Promise<CatalogoResultParaBot[]> {
  const { data } = await searchCatalogo(orgId, {
    q: args.query,
    categoria: args.categoria ?? null,
    status: 'active',
    limit: 8,
    withCount: false,
  })
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
