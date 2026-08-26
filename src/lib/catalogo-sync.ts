import { google } from 'googleapis'
import { prisma } from '@/lib/db'
import { normalizeCatalogRow, type CatalogRawRow } from '@/lib/catalogo-import'
import { resolveCategoryId, type CategoryCache } from '@/lib/catalogo-categories'

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
  skippedNoSku?: number
  categoriesSeen?: number
  /** SKUs del catálogo que no aparecieron en esta corrida — sólo se
   * reportan, nunca se desactivan solos (ver decisión de conflictos en el
   * plan: un ADMIN decide a mano si de verdad hay que dar de baja algo). */
  skusNotSeenThisRun?: string[]
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
  const categoryCache: CategoryCache = new Map()
  let processed = 0
  let skippedNoSku = 0
  const seenSkus = new Set<string>()
  const seenCategoryPaths = new Set<string>()

  for (const row of dataRows) {
    const rawRow = {} as CatalogRawRow
    headers.forEach((header, i) => {
      ;(rawRow as Record<string, unknown>)[header] = row[i] ?? null
    })

    const normalized = normalizeCatalogRow(rawRow)
    if (!normalized) { skippedNoSku++; continue }

    seenSkus.add(normalized.sku)
    if (normalized.categoryPath.length > 0) seenCategoryPaths.add(normalized.categoryPath.join(' > '))

    const categoryId = normalized.categoryPath.length > 0
      ? await resolveCategoryId(prisma, orgId, normalized.categoryPath, categoryCache)
      : null

    await prisma.product.upsert({
      where: { organizationId_sku: { organizationId: orgId, sku: normalized.sku } },
      create: {
        organizationId: orgId,
        sku: normalized.sku,
        name: normalized.name,
        description: normalized.description,
        brand: normalized.brand,
        mpn: normalized.mpn,
        categoryId,
        imageUrl: normalized.imageUrl,
        costo: normalized.costo,
        ivaPct: normalized.ivaPct,
        precioGremio: normalized.precioGremio,
        price: normalized.price ?? 0,
        supplier: normalized.supplier,
        supplierAvailability: normalized.supplierAvailability,
        active: true,
        catalogSource: 'GOOGLE_SHEETS',
        lastSyncedAt: new Date(),
      },
      update: {
        name: normalized.name,
        description: normalized.description,
        brand: normalized.brand,
        mpn: normalized.mpn,
        categoryId,
        // La foto sólo se pisa si esta fila trae una URL real — el Sheet
        // sólo puede traer fotos por URL de texto (a diferencia del Excel,
        // que las tenía embebidas); si no hay URL en esta corrida, se
        // conserva la que ya hubiera.
        ...(normalized.imageUrl ? { imageUrl: normalized.imageUrl } : {}),
        costo: normalized.costo,
        ivaPct: normalized.ivaPct,
        precioGremio: normalized.precioGremio,
        price: normalized.price ?? 0,
        supplier: normalized.supplier,
        supplierAvailability: normalized.supplierAvailability,
        catalogSource: 'GOOGLE_SHEETS',
        lastSyncedAt: new Date(),
      },
    })
    processed++
  }

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
    skippedNoSku,
    categoriesSeen: seenCategoryPaths.size,
    skusNotSeenThisRun,
  }
}
