/**
 * Ejecuta `fn` sobre `items` con a lo sumo `limit` llamadas en simultáneo —
 * ni todo secuencial (lento contra una base remota con latencia por
 * request, ver el mismatch de región Vercel↔Supabase ya documentado en
 * src/lib/auth.ts) ni todo junto (satura el pool de conexiones del
 * pooler). Usado por el importador de catálogo y el sync de Google Sheets,
 * ambos con potencialmente miles de filas para upsertear.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
