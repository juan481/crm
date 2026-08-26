// Lógica compartida de "columna de la fuente → campo de Product" para el
// catálogo de Abba Seguridad. Un solo lugar donde vive qué significa cada
// columna, usado tanto por el importador one-off del Excel
// (scripts/import-catalogo-excel.ts) como por el sync recurrente de Google
// Sheets (src/lib/catalogo-sync.ts) — evita que las dos fuentes interpreten
// las columnas de manera distinta con el tiempo.
//
// Headers reales confirmados contra el Excel del proveedor
// (crm/catalogo/ABBA - CRM_PROGRAMADOR - SOLO IMPORTACION.xlsx, hoja
// CRM_IMPORTAR): "Codigo interno (SKU)", "Descripcion corta",
// "Descripcion larga", "Marca", "Modelo / N° de parte del fabricante",
// "Categoria/Rubro", "Foto", "Costo (USD)", "IVA (%)", "Precio Gremio
// (USD)", "Precio Publico (USD)", "Proveedor", "Disponibilidad/Stock". El
// Google Sheet del proveedor usa las mismas columnas (mismo origen de
// datos), por eso una sola función de normalización sirve para ambas
// fuentes.

export interface CatalogRawRow {
  'Codigo interno (SKU)'?: unknown
  'Descripcion corta'?: unknown
  'Descripcion larga'?: unknown
  Marca?: unknown
  'Modelo / N° de parte del fabricante'?: unknown
  'Categoria/Rubro'?: unknown
  Foto?: unknown
  'Costo (USD)'?: unknown
  'IVA (%)'?: unknown
  'Precio Gremio (USD)'?: unknown
  'Precio Publico (USD)'?: unknown
  Proveedor?: unknown
  'Disponibilidad/Stock'?: unknown
}

export interface NormalizedCatalogRow {
  sku: string
  name: string
  description: string | null
  brand: string | null
  mpn: string | null
  /** Ej. ['CCTV', 'CAMARAS IP WIFI'] — ya separado por nivel, sin el " > " literal. */
  categoryPath: string[]
  costo: number | null
  ivaPct: number | null
  precioGremio: number | null
  /** Precio Publico del proveedor — se persiste en Product.price. */
  price: number | null
  supplier: string | null
  supplierAvailability: string | null
  /** URL de foto si la fuente la trae como texto (Google Sheets). El
   * importador de Excel resuelve la foto aparte (imagen embebida, no texto
   * de celda) y la pisa después de llamar a esta función. */
  imageUrl: string | null
}

function toTrimmedString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).normalize('NFC').replace(/\s+/g, ' ').trim()
  return s.length > 0 ? s : null
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.').trim())
  return Number.isFinite(n) ? n : null
}

function isUrl(value: string | null): value is string {
  return !!value && /^https?:\/\//i.test(value)
}

/**
 * Normaliza una fila cruda (Excel o Google Sheets, mismas columnas) a un
 * shape estable para upsert de Product. Devuelve `null` si la fila no tiene
 * SKU — no es un producto válido, se descarta silenciosamente (el
 * importador cuenta cuántas filas se descartaron así para el reporte
 * final, no falla la corrida completa por una fila vacía de la plantilla).
 */
export function normalizeCatalogRow(raw: CatalogRawRow): NormalizedCatalogRow | null {
  const sku = toTrimmedString(raw['Codigo interno (SKU)'])
  if (!sku) return null

  const categoriaRaw = toTrimmedString(raw['Categoria/Rubro'])
  const categoryPath = categoriaRaw
    ? categoriaRaw.split('>').map((s) => s.trim()).filter(Boolean)
    : []

  // "Foto" en el Excel sólo trae "SIN FOTO" o nada (la imagen real está
  // embebida, no es texto) — en el Sheet en cambio puede traer una URL real
  // si el proveedor pega un link de Drive en vez de insertar la imagen.
  const fotoTexto = toTrimmedString(raw.Foto)
  const imageUrl = isUrl(fotoTexto) ? fotoTexto : null

  return {
    sku,
    name: toTrimmedString(raw['Descripcion corta']) ?? sku,
    description: toTrimmedString(raw['Descripcion larga']),
    brand: toTrimmedString(raw.Marca),
    mpn: toTrimmedString(raw['Modelo / N° de parte del fabricante']),
    categoryPath,
    costo: toNumberOrNull(raw['Costo (USD)']),
    ivaPct: toNumberOrNull(raw['IVA (%)']),
    precioGremio: toNumberOrNull(raw['Precio Gremio (USD)']),
    price: toNumberOrNull(raw['Precio Publico (USD)']),
    supplier: toTrimmedString(raw.Proveedor),
    supplierAvailability: toTrimmedString(raw['Disponibilidad/Stock']),
    imageUrl,
  }
}
