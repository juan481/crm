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
