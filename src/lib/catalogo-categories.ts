import type { PrismaClient } from '@prisma/client'

// key: `${parentId ?? 'root'}::${name}` -> id ya resuelto en esta corrida.
export type CategoryCache = Map<string, string>

/**
 * Resuelve (o crea) la cadena de ProductCategory para un categoryPath
 * jerárquico (ej. ['CCTV', 'CAMARAS IP WIFI']) y devuelve el id de la
 * categoría más profunda (hoja), o null si categoryPath viene vacío.
 *
 * Usa `findFirst`-then-`create` con un Map en memoria como cache, en vez de
 * un `upsert` — un `@@unique([organizationId, parentId, name])` NO
 * deduplicaría categorías de nivel 1 entre sí en Postgres, porque NULL
 * nunca es igual a NULL para una unique constraint. Pensada para una
 * corrida serial (script de importación o sync programado) — no es segura
 * ante llamadas concurrentes sin compartir el mismo `cache`.
 */
/**
 * Precarga TODAS las categorías existentes de la organización en el cache,
 * de una sola consulta — evita que resolveCategoryId tenga que pedirle a la
 * base, una por una y en serie, cada una de las ~184 categorías del árbol
 * en CADA corrida del sync (aunque ninguna sea nueva). Encontrado
 * auditando por qué la primera sincronización con Google Sheets se cortaba
 * contra el límite de tiempo de la función serverless: 184 round-trips
 * seriales de ~250ms cada uno (latencia ya documentada al pooler de
 * Supabase) son ~46s ya gastados antes de escribir un solo producto. Con
 * esto, sólo paga ese costo una categoría genuinamente nueva que el
 * proveedor agregue — el caso normal (nada nuevo) queda en una sola
 * consulta total.
 */
export async function preloadCategoryCache(db: PrismaClient, orgId: string, cache: CategoryCache): Promise<void> {
  const all = await db.productCategory.findMany({
    where: { organizationId: orgId },
    select: { id: true, parentId: true, name: true },
  })
  for (const c of all) {
    cache.set(`${c.parentId ?? 'root'}::${c.name}`, c.id)
  }
}

export async function resolveCategoryId(
  db: PrismaClient,
  orgId: string,
  categoryPath: string[],
  cache: CategoryCache
): Promise<string | null> {
  let parentId: string | null = null

  for (const name of categoryPath) {
    const cacheKey = `${parentId ?? 'root'}::${name}`
    const cached = cache.get(cacheKey)
    if (cached) {
      parentId = cached
      continue
    }

    const existing = await db.productCategory.findFirst({
      where: { organizationId: orgId, parentId, name },
      select: { id: true },
    })

    let id: string
    if (existing) {
      id = existing.id
    } else {
      const created = await db.productCategory.create({
        data: { organizationId: orgId, parentId, name },
        select: { id: true },
      })
      id = created.id
    }

    cache.set(cacheKey, id)
    parentId = id
  }

  return parentId
}
