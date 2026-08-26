import { google } from 'googleapis'
import { prisma } from '@/lib/db'
import { normalizeCatalogRow, type CatalogRawRow } from '@/lib/catalogo-import'
import { resolveCategoryId, type CategoryCache } from '@/lib/catalogo-categories'
import { mapWithConcurrency } from '@/lib/concurrency'

// Upserts en paralelo — con ~2296 SKUs (tamaño real del catálogo de Abba)
// un upsert por vez tardaba varios minutos contra el pooler remoto (~200-
// 300ms/request, mismatch de región Vercel↔Supabase ya documentado en
// src/lib/auth.ts), arriesgando el timeout de la función serverless del
// cron (api/cron/catalogo-sync, cada 4hs). No aplica a la resolución de
// categorías, que tiene que ser serial (ver más abajo).
const UPSERT_CONCURRENCY = 8

const DEFAULT_TAB = 'CRM_IMPORTAR'
// Mismas columnas que la importación inicial desde Excel (ver
// src/lib/catalogo-import.ts) — el proveedor comparte los mismos datos por
// las dos vías.
const EXPECTED_HEADERS = [
  'Codigo interno (SKU)', 'Descripcion corta', 'Descripcion larga', 'Marca',
  'Modelo / N° de parte del fabricante', 'Categoria/Rubro', 'Foto',
  'Costo (USD)', 'IVA (%)', 'Precio Gremio (USD)', 'Precio Publico (USD)',
  'Proveedor', 'Disponibilidad/Stock',
] as const

export interface CatalogSyncResult {
  ok: boolean
  error?: string
  rowsRead?: number
  processed?: number
  /** De `processed`, cuántos realmente escribieron algo — el resto ya
   * estaba idéntico al Sheet y se saltó sin tocar la base (ver
   * hasRelevantChange más abajo). En una sync recurrente típica (cada 4hs,
   * el proveedor cambia un puñado de filas) esto reduce ~2296 escrituras a
   * unas pocas. */
  written?: number
  skippedNoSku?: number
  categoriesSeen?: number
  /** SKUs del catálogo que no aparecieron en esta corrida — sólo se
   * reportan, nunca se desactivan solos (ver decisión de conflictos en el
   * plan: un ADMIN decide a mano si de verdad hay que dar de baja algo). */
  skusNotSeenThisRun?: string[]
}

const COMPARABLE_FIELDS = [
  'name', 'description', 'brand', 'mpn', 'categoryId', 'costo', 'ivaPct', 'precioGremio', 'price', 'supplier', 'supplierAvailability',
] as const

// Compara sólo los campos que el Sheet realmente controla — deliberadamente
// NO incluye imageUrl (la foto puede quedar igual mientras el Sheet no
// traiga URL, sin que eso cuente como "sin cambios" si algo más sí cambió;
// y si nada más cambió tampoco vale la pena reescribir sólo por eso) ni
// catalogSource/lastSyncedAt/active (metadata de la sync en sí, no datos
// del proveedor). `undefined` en `candidate[f]` (no debería pasar, todos
// los campos de NormalizedCatalogRow están siempre presentes) se trata
// como "sin cambio" para ese campo.
export function hasRelevantChange(existing: Record<string, unknown>, candidate: Record<string, unknown>): boolean {
  return COMPARABLE_FIELDS.some((f) => existing[f] !== candidate[f])
}

function getServiceAccountAuth() {
  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL
  const key = process.env.GOOGLE_SHEETS_PRIVATE_KEY
  if (!email || !key) return null
  return new google.auth.JWT({
    email,
    // El private key suele venir de una env var con "\n" literales en vez
    // de saltos de línea reales (así se pega en un .env de una sola línea).
    key: key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

/**
 * Trae el catálogo desde un Google Sheet (Service Account, sólo lectura) y
 * hace upsert por SKU — mismas reglas de columnas que el importador de
 * Excel (src/lib/catalogo-import.ts → normalizeCatalogRow). El Sheet pisa
 * siempre los campos de catálogo; nunca toca trackStock/stock/movimientos
 * (inventario propio de Abba) ni desactiva productos por sí solo.
 */
export async function syncCatalogFromGoogleSheet(
  orgId: string,
  config: { sheetId?: string; sheetTabName?: string }
): Promise<CatalogSyncResult> {
  if (!config?.sheetId) {
    return { ok: false, error: 'Falta configurar el ID del Google Sheet en el plugin "Catálogo · Sync con Google Sheets".' }
  }

  const auth = getServiceAccountAuth()
  if (!auth) {
    return {
      ok: false,
      error: 'Faltan las credenciales de la cuenta de servicio de Google en el servidor (env vars GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY). Contactá a quien administra el hosting del CRM.',
    }
  }

  const sheets = google.sheets({ version: 'v4', auth })
  const tab = config.sheetTabName?.trim() || DEFAULT_TAB

  let values: string[][]
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: config.sheetId, range: tab })
    values = (res.data.values as string[][]) ?? []
  } catch (err: unknown) {
    const message = (err as { errors?: { message?: string }[]; message?: string })?.errors?.[0]?.message
      ?? (err as { message?: string })?.message
      ?? 'Error desconocido'
    return {
      ok: false,
      error: `No se pudo leer el Google Sheet: ${message}. Confirmá que el Sheet fue compartido como "Lector" con ${process.env.GOOGLE_SHEETS_CLIENT_EMAIL}, y que el ID y el nombre de pestaña ("${tab}") son correctos.`,
    }
  }

  if (values.length < 2) {
    return { ok: false, error: `La pestaña "${tab}" del Sheet no tiene filas de datos (o no existe).` }
  }

  const headers = values[0]
  const missingHeaders = EXPECTED_HEADERS.filter((h) => !headers.includes(h))
  if (missingHeaders.length > 0) {
    return {
      ok: false,
      error: `El Sheet no tiene las columnas esperadas: ${missingHeaders.join(', ')}. Deben ser exactamente iguales a las del Excel original.`,
    }
  }

  const dataRows = values.slice(1)
  let skippedNoSku = 0
  const seenSkus = new Set<string>()
  const seenCategoryPaths = new Set<string>()
  const normalizedRows: NonNullable<ReturnType<typeof normalizeCatalogRow>>[] = []

  for (const row of dataRows) {
    const rawRow = {} as CatalogRawRow
    headers.forEach((header, i) => {
      ;(rawRow as Record<string, unknown>)[header] = row[i] ?? null
    })

    const normalized = normalizeCatalogRow(rawRow)
    if (!normalized) { skippedNoSku++; continue }

    seenSkus.add(normalized.sku)
    if (normalized.categoryPath.length > 0) seenCategoryPaths.add(normalized.categoryPath.join(' > '))
    normalizedRows.push(normalized)
  }

  // Categorías primero, en SERIE — resolveCategoryId no es segura ante
  // llamadas concurrentes (dos filas resolviendo la MISMA categoría nueva a
  // la vez podrían crearla duplicada). Con el cache ya completo, el paso
  // paralelo de abajo sólo pega hits, sin más escrituras a ProductCategory.
  const categoryCache: CategoryCache = new Map()
  const categoryIdByRow: (string | null)[] = new Array(normalizedRows.length).fill(null)
  for (let i = 0; i < normalizedRows.length; i++) {
    const { categoryPath } = normalizedRows[i]
    categoryIdByRow[i] = categoryPath.length > 0
      ? await resolveCategoryId(prisma, orgId, categoryPath, categoryCache)
      : null
  }

  // Traído una sola vez para poder saltear (no reescribir) las filas que
  // el Sheet trae idénticas a lo que ya está en la base — ver
  // hasRelevantChange. Clave del rendimiento en una sync RECURRENTE: la
  // primera corrida (o una migración EXCEL_IMPORT→GOOGLE_SHEETS) escribe
  // igual que antes, pero cada corrida siguiente del cron sólo toca los
  // SKUs que el proveedor realmente cambió.
  const db = prisma as any
  const existingProducts = await db.product.findMany({
    where: { organizationId: orgId, sku: { in: normalizedRows.map((r) => r.sku) } },
    select: { sku: true, catalogSource: true, ...Object.fromEntries(COMPARABLE_FIELDS.map((f) => [f, true])) },
  })
  const existingBySku = new Map<string, any>(existingProducts.map((p: any) => [p.sku as string, p]))

  let processed = 0
  let written = 0
  await mapWithConcurrency(normalizedRows, UPSERT_CONCURRENCY, async (normalized, i) => {
    const categoryId = categoryIdByRow[i]
    const candidate: Record<string, unknown> = {
      name: normalized.name, description: normalized.description, brand: normalized.brand, mpn: normalized.mpn,
      categoryId, costo: normalized.costo, ivaPct: normalized.ivaPct, precioGremio: normalized.precioGremio,
      price: normalized.price ?? 0, supplier: normalized.supplier, supplierAvailability: normalized.supplierAvailability,
    }
    const existing = existingBySku.get(normalized.sku)
    // Ya existe, ya vino de Sheets antes (no una migración desde
    // EXCEL_IMPORT) y ningún campo comparable cambió → nada que escribir.
    if (existing && existing.catalogSource === 'GOOGLE_SHEETS' && !hasRelevantChange(existing as Record<string, unknown>, candidate)) {
      processed++
      return
    }

    await db.product.upsert({
      where: { organizationId_sku: { organizationId: orgId, sku: normalized.sku } },
      create: {
        organizationId: orgId,
        sku: normalized.sku,
        ...candidate,
        imageUrl: normalized.imageUrl,
        active: true,
        catalogSource: 'GOOGLE_SHEETS',
        lastSyncedAt: new Date(),
      },
      update: {
        ...candidate,
        // La foto sólo se pisa si esta fila trae una URL real — el Sheet
        // sólo puede traer fotos por URL de texto (a diferencia del Excel,
        // que las tenía embebidas); si no hay URL en esta corrida, se
        // conserva la que ya hubiera.
        ...(normalized.imageUrl ? { imageUrl: normalized.imageUrl } : {}),
        catalogSource: 'GOOGLE_SHEETS',
        lastSyncedAt: new Date(),
      },
    })
    processed++
    written++
  })

  const existingSkus = await prisma.product.findMany({
    where: { organizationId: orgId, sku: { not: null }, active: true },
    select: { sku: true },
  })
  const skusNotSeenThisRun = existingSkus
    .map((p) => p.sku as string)
    .filter((sku) => !seenSkus.has(sku))
    .slice(0, 50)

  return {
    ok: true,
    rowsRead: dataRows.length,
    processed,
    written,
    skippedNoSku,
    categoriesSeen: seenCategoryPaths.size,
    skusNotSeenThisRun,
  }
}
