// Importador one-off del catálogo de productos de Abba Seguridad desde el
// Excel del proveedor (imágenes embebidas incluidas). Corrido a mano, nunca
// vía un endpoint HTTP — 2296 filas + ~1238 imágenes no entran en el
// timeout de una función serverless.
//
// La interpretación de columnas vive en src/lib/catalogo-import.ts
// (normalizeCatalogRow), compartida con el sync de Google Sheets
// (src/lib/catalogo-sync.ts) — este script sólo se ocupa de: leer el
// .xlsx, extraer las fotos embebidas (el Excel no las tiene como URL de
// texto, están ancladas por fila en xl/drawings/drawing1.xml), y hacer el
// upsert por SKU.
//
// Uso: npx tsx scripts/import-catalogo-excel.ts ["ruta/al.xlsx"] [--org="Abba Seguridad"] [--dry-run] [--skip-images]
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { prisma } from '../src/lib/db'
import { createAdminClient } from '../src/lib/supabase/admin'
import { normalizeCatalogRow, type CatalogRawRow } from '../src/lib/catalogo-import'
import { resolveCategoryId, type CategoryCache } from '../src/lib/catalogo-categories'

const DEFAULT_FILE = 'catalogo/ABBA - CRM_PROGRAMADOR - SOLO IMPORTACION.xlsx'
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'uploads'
const UPLOAD_CONCURRENCY = 8

function parseArgs(argv: string[]) {
  const positional = argv.filter((a) => !a.startsWith('--'))
  const flags = new Set(argv.filter((a) => a.startsWith('--') && !a.includes('=')))
  const kv = new Map<string, string>()
  for (const a of argv) {
    if (a.startsWith('--') && a.includes('=')) {
      const [k, ...rest] = a.slice(2).split('=')
      kv.set(k, rest.join('='))
    }
  }
  return {
    filePath: positional[0] ?? DEFAULT_FILE,
    orgName: kv.get('org') ?? 'Abba Seguridad',
    dryRun: flags.has('--dry-run'),
    skipImages: flags.has('--skip-images'),
  }
}

/** Ejecuta `fn` sobre `items` con a lo sumo `limit` llamadas en simultáneo. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
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

/**
 * Parsea xl/drawings/drawing1.xml + su .rels y devuelve, por índice de fila
 * de datos (0-indexed, igual que el array que devuelve sheet_to_json), el
 * Buffer de la imagen anclada a la columna "Foto" de esa fila.
 */
async function extractRowImages(zip: JSZip, fotoColIndex: number): Promise<Map<number, Buffer>> {
  const result = new Map<number, Buffer>()

  const drawingFile = zip.file('xl/drawings/drawing1.xml')
  const relsFile = zip.file('xl/drawings/_rels/drawing1.xml.rels')
  if (!drawingFile || !relsFile) {
    console.warn('⚠ No se encontró xl/drawings/drawing1.xml — el Excel no tiene imágenes embebidas, o vive en otro drawing.')
    return result
  }

  const drawingXml = await drawingFile.async('string')
  const relsXml = await relsFile.async('string')

  // rId -> "xl/media/imageN.jpg"
  const relTargets = new Map<string, string>()
  for (const m of Array.from(relsXml.matchAll(/<Relationship\s+Id="(rId\d+)"[^>]*Target="([^"]+)"/g))) {
    relTargets.set(m[1], m[2].replace(/^\.\.\//, 'xl/'))
  }

  const anchorRegex = /<xdr:oneCellAnchor>([\s\S]*?)<\/xdr:oneCellAnchor>/g
  for (const anchorMatch of Array.from(drawingXml.matchAll(anchorRegex))) {
    const inner = anchorMatch[1]
    const col = /<xdr:col>(\d+)<\/xdr:col>/.exec(inner)?.[1]
    const row = /<xdr:row>(\d+)<\/xdr:row>/.exec(inner)?.[1]
    const rId = /r:embed="(rId\d+)"/.exec(inner)?.[1]
    if (col === undefined || row === undefined || !rId) continue
    if (Number(col) !== fotoColIndex) continue // ancla en otra columna, no es una foto de producto

    const target = relTargets.get(rId)
    if (!target) continue
    const mediaFile = zip.file(target)
    if (!mediaFile) continue

    // xdr:row es 0-indexed sobre TODA la hoja (fila 0 = header) — la fila de
    // datos correspondiente en el array de sheet_to_json es row - 1.
    const dataRowIndex = Number(row) - 1
    if (dataRowIndex < 0) continue

    const buffer = await mediaFile.async('nodebuffer')
    result.set(dataRowIndex, buffer)
  }

  return result
}

async function main() {
  const { filePath, orgName, dryRun, skipImages } = parseArgs(process.argv.slice(2))

  const org = await prisma.organization.findFirst({ where: { name: orgName } })
  if (!org) {
    console.error(`No se encontró ninguna organización llamada "${orgName}"`)
    process.exit(1)
  }
  console.log(`Organización: ${org.name} (${org.id})`)
  console.log(`Archivo: ${filePath}${dryRun ? '  [DRY RUN — no escribe nada]' : ''}`)

  const fileBuffer = readFileSync(filePath)
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const headerRow = (XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as string[]) ?? []
  const fotoColIndex = headerRow.indexOf('Foto')
  const rows = XLSX.utils.sheet_to_json<CatalogRawRow>(sheet, { defval: null })
  console.log(`Hoja "${sheetName}": ${rows.length} filas leídas. Columna "Foto" en índice ${fotoColIndex}.`)

  // ── Imágenes ──────────────────────────────────────────────────────────
  let rowImageByHash = new Map<number, string>() // dataRowIndex -> hash
  let hashToUrl = new Map<string, string>()
  let uniqueImagesUploaded = 0

  if (!skipImages && fotoColIndex >= 0) {
    const zip = await JSZip.loadAsync(fileBuffer)
    const rowImages = await extractRowImages(zip, fotoColIndex)
    console.log(`Anclas de imagen encontradas: ${rowImages.size}`)

    // Dedup por hash de contenido — muchas filas comparten la misma imagen
    // placeholder.
    const hashToBuffer = new Map<string, Buffer>()
    for (const [rowIndex, buffer] of Array.from(rowImages)) {
      const hash = createHash('sha256').update(buffer).digest('hex')
      rowImageByHash.set(rowIndex, hash)
      if (!hashToBuffer.has(hash)) hashToBuffer.set(hash, buffer)
    }
    console.log(`Imágenes únicas por contenido: ${hashToBuffer.size}`)

    if (!dryRun) {
      const supabase = createAdminClient()
      const entries = Array.from(hashToBuffer.entries())
      await mapWithConcurrency(entries, UPLOAD_CONCURRENCY, async ([hash, buffer]) => {
        const path = `catalogo/${org.id}/${hash}.jpg`
        const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: 'image/jpeg', upsert: true })
        if (error) {
          console.error(`  ✗ Error subiendo imagen ${hash}: ${error.message}`)
          return
        }
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
        hashToUrl.set(hash, data.publicUrl)
        uniqueImagesUploaded++
      })
      console.log(`Imágenes subidas a Storage: ${uniqueImagesUploaded}/${hashToBuffer.size}`)
    }
  } else if (skipImages) {
    console.log('Extracción de imágenes omitida (--skip-images).')
  } else {
    console.warn('⚠ No se encontró la columna "Foto" en el header — no se procesan imágenes.')
  }

  // ── Categorías + productos ───────────────────────────────────────────
  const categoryCache: CategoryCache = new Map()
  let processed = 0
  let skippedNoSku = 0
  let withoutPhoto = 0
  let zeroCost = 0
  const seenCategoryPaths = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const normalized = normalizeCatalogRow(rows[i])
    if (!normalized) { skippedNoSku++; continue }

    const hash = rowImageByHash.get(i)
    const imageUrl = (hash && hashToUrl.get(hash)) || normalized.imageUrl || null
    // En --dry-run no se sube nada, así que hashToUrl siempre está vacío —
    // "sin foto" se mide por si HABÍA un ancla/URL resuelta, no por si esta
    // corrida efectivamente subió el archivo.
    if (!hash && !normalized.imageUrl) withoutPhoto++
    if ((normalized.costo ?? 0) === 0) zeroCost++
    if (normalized.categoryPath.length > 0) seenCategoryPaths.add(normalized.categoryPath.join(' > '))

    if (dryRun) { processed++; continue }

    const categoryId = normalized.categoryPath.length > 0
      ? await resolveCategoryId(prisma, org.id, normalized.categoryPath, categoryCache)
      : null

    await prisma.product.upsert({
      where: { organizationId_sku: { organizationId: org.id, sku: normalized.sku } },
      create: {
        organizationId: org.id,
        sku: normalized.sku,
        name: normalized.name,
        description: normalized.description,
        brand: normalized.brand,
        mpn: normalized.mpn,
        categoryId,
        imageUrl,
        costo: normalized.costo,
        ivaPct: normalized.ivaPct,
        precioGremio: normalized.precioGremio,
        price: normalized.price ?? 0,
        supplier: normalized.supplier,
        supplierAvailability: normalized.supplierAvailability,
        active: true,
        catalogSource: 'EXCEL_IMPORT',
        lastSyncedAt: new Date(),
      },
      // trackStock/stock NUNCA se tocan acá — son inventario propio de Abba,
      // ajenos al catálogo del proveedor.
      update: {
        name: normalized.name,
        description: normalized.description,
        brand: normalized.brand,
        mpn: normalized.mpn,
        categoryId,
        imageUrl,
        costo: normalized.costo,
        ivaPct: normalized.ivaPct,
        precioGremio: normalized.precioGremio,
        price: normalized.price ?? 0,
        supplier: normalized.supplier,
        supplierAvailability: normalized.supplierAvailability,
        catalogSource: 'EXCEL_IMPORT',
        lastSyncedAt: new Date(),
      },
    })
    processed++
    if (processed % 250 === 0) console.log(`  ... ${processed} productos procesados`)
  }

  console.log('\n── Reporte final ──────────────────────────────────────')
  console.log(`Filas en la hoja:            ${rows.length}`)
  console.log(`Productos procesados:        ${processed}`)
  console.log(`Filas sin SKU (descartadas): ${skippedNoSku}`)
  console.log(`Categorías distintas vistas: ${seenCategoryPaths.size}`)
  console.log(`Productos sin foto:          ${withoutPhoto}`)
  console.log(`Productos con costo = 0:     ${zeroCost} (importados igual, active:true)`)
  if (dryRun) console.log('\n[DRY RUN] No se escribió nada en la base ni en Storage.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
