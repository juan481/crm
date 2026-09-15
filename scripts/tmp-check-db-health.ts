import { prisma } from '../src/lib/db'

async function main() {
  const db = prisma as any

  console.log('\n=== 1. Conexiones activas vs max_connections ===')
  const maxConn = await db.$queryRawUnsafe(`SHOW max_connections`)
  const activity = await db.$queryRawUnsafe(`
    SELECT state, count(*)::int AS n
    FROM pg_stat_activity
    WHERE datname = current_database()
    GROUP BY state
    ORDER BY n DESC
  `)
  console.log('max_connections:', maxConn)
  console.log('conexiones actuales por estado:', activity)

  console.log('\n=== 2. Tamano de la base y de las tablas mas grandes ===')
  const dbSize = await db.$queryRawUnsafe(`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`)
  console.log('tamano total DB:', dbSize)
  const bigTables = await db.$queryRawUnsafe(`
    SELECT relname AS tabla, pg_size_pretty(pg_total_relation_size(relid)) AS tamano,
           n_live_tup AS filas_vivas
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(relid) DESC
    LIMIT 10
  `)
  console.log('top 10 tablas por tamano:', bigTables)

  console.log('\n=== 3. Cache hit ratio (bajo = esta leyendo mucho de disco, no de RAM) ===')
  const cacheHit = await db.$queryRawUnsafe(`
    SELECT
      sum(heap_blks_read) AS leido_disco,
      sum(heap_blks_hit)  AS leido_cache,
      round(
        (sum(heap_blks_hit)::numeric / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0)) * 100,
      2) AS pct_cache_hit
    FROM pg_statio_user_tables
  `)
  console.log('cache hit ratio:', cacheHit)

  console.log('\n=== 4. Tablas con mas "seq scan" que "index scan" (posibles indices faltantes) ===')
  const seqScans = await db.$queryRawUnsafe(`
    SELECT relname AS tabla, seq_scan, seq_tup_read, idx_scan,
           CASE WHEN idx_scan = 0 THEN seq_scan ELSE round(seq_scan::numeric / idx_scan, 1) END AS ratio_seq_vs_idx
    FROM pg_stat_user_tables
    WHERE seq_scan > 0
    ORDER BY seq_tup_read DESC
    LIMIT 10
  `)
  console.log('seq scans mas pesados:', seqScans)

  console.log('\n=== 5. Settings clave (indican el compute tier real) ===')
  const settings = await db.$queryRawUnsafe(`
    SELECT name, setting, unit
    FROM pg_settings
    WHERE name IN ('shared_buffers','work_mem','effective_cache_size','max_connections','max_parallel_workers')
  `)
  console.log('settings:', settings)

  console.log('\n=== 6. Version y uptime del server ===')
  const version = await db.$queryRawUnsafe(`SELECT version()`)
  const uptime = await db.$queryRawUnsafe(`SELECT pg_postmaster_start_time()::text AS arranco, (now() - pg_postmaster_start_time())::text AS uptime`)
  console.log('version:', version)
  console.log('uptime:', uptime)

  console.log('\n=== 7. Queries lentas activas AHORA MISMO (si hay alguna colgada) ===')
  const longRunning = await db.$queryRawUnsafe(`
    SELECT pid, (now() - query_start)::text AS duracion, state, left(query, 100) AS query
    FROM pg_stat_activity
    WHERE state != 'idle' AND query_start IS NOT NULL AND datname = current_database()
    ORDER BY duracion DESC
    LIMIT 10
  `)
  console.log('queries activas:', longRunning)

  console.log('\n=== 8. pg_stat_statements (top queries por tiempo total, si la extension esta habilitada) ===')
  try {
    const topQueries = await db.$queryRawUnsafe(`
      SELECT left(query, 120) AS query, calls, round(total_exec_time::numeric, 1) AS ms_total,
             round(mean_exec_time::numeric, 1) AS ms_promedio
      FROM pg_stat_statements
      ORDER BY total_exec_time DESC
      LIMIT 10
    `)
    console.log('top queries:', topQueries)
  } catch (e: any) {
    console.log('pg_stat_statements no disponible/habilitada:', e.message?.split('\n')[0])
  }
}

main()
  .catch((e) => console.error('ERROR:', e))
  .finally(() => prisma.$disconnect())
