import { prisma } from '@/lib/db'

// Lógica compartida de productos KIT (Product.isKit=true + ProductComponent[]).
// Un KIT se cotiza como UNA línea con UN precio (Product.price, editable a
// mano). El desglose de componentes y el margen son SÓLO para la vista
// interna de Abba — al cliente final nunca se le muestra.

export const KIT_COMPONENT_SELECT = {
  id: true, quantity: true, componentId: true,
  component: {
    select: { id: true, name: true, sku: true, price: true, currency: true, costo: true, stock: true, trackStock: true },
  },
} as const

export const KIT_SELECT = {
  id: true, name: true, description: true, price: true, currency: true, unit: true,
  isKit: true, active: true, trackStock: true, stock: true, organizationId: true, createdAt: true,
  kitComponents: { select: KIT_COMPONENT_SELECT, orderBy: { createdAt: 'asc' as const } },
} as const

interface RawKit {
  id: string; name: string; price: number; currency: string
  kitComponents: { quantity: number; component: { price: number; costo: number | null; stock: number; trackStock: boolean } }[]
  [k: string]: unknown
}

/** Agrega subtotal de componentes, costo y margen a un KIT ya traído con KIT_SELECT. */
export function withKitMetrics<T extends RawKit>(kit: T) {
  const componentesSubtotal = kit.kitComponents.reduce((s, c) => s + c.component.price * c.quantity, 0)
  const componentesCosto = kit.kitComponents.reduce((s, c) => s + (c.component.costo ?? 0) * c.quantity, 0)
  const margen = kit.price - componentesSubtotal
  const margenPct = kit.price > 0 ? (margen / kit.price) * 100 : 0
  const algunComponenteSinStock = kit.kitComponents.some((c) => c.component.trackStock && c.component.stock < c.quantity)
  return { ...kit, componentesSubtotal, componentesCosto, margen, margenPct, algunComponenteSinStock }
}

export interface ComponentInput {
  productId?: string
  sku?: string
  quantity?: number
}

export interface ResolvedComponent {
  input: ComponentInput
  productId: string | null
  name: string | null
  sku: string | null
  price: number | null
  quantity: number
  error: string | null
}

/**
 * Resuelve una lista de componentes (por productId o por SKU) contra el
 * catálogo de la organización. Rechaza: productos de otra org, productos que
 * a su vez son KIT (no se anidan KITs), y códigos que no existen.
 */
export async function resolveComponents(orgId: string, inputs: ComponentInput[]): Promise<ResolvedComponent[]> {
  const db = prisma as any

  const ids = inputs.map((i) => i.productId).filter(Boolean) as string[]
  const skus = inputs.map((i) => i.sku?.trim()).filter(Boolean) as string[]

  const [byId, bySku] = await Promise.all([
    ids.length
      ? db.product.findMany({ where: { id: { in: ids }, organizationId: orgId }, select: { id: true, name: true, sku: true, price: true, isKit: true } })
      : [],
    skus.length
      ? db.product.findMany({ where: { organizationId: orgId, sku: { in: skus } }, select: { id: true, name: true, sku: true, price: true, isKit: true } })
      : [],
  ])
  const idMap = new Map<string, any>(byId.map((p: any) => [p.id, p]))
  const skuMap = new Map<string, any>(bySku.map((p: any) => [String(p.sku).toLowerCase(), p]))

  return inputs.map((input): ResolvedComponent => {
    const quantity = Math.max(1, Math.round(Number(input.quantity) || 1))
    const p = input.productId
      ? idMap.get(input.productId)
      : input.sku
        ? skuMap.get(input.sku.trim().toLowerCase())
        : null

    if (!p) {
      return { input, productId: null, name: null, sku: input.sku ?? null, price: null, quantity, error: 'No se encontró en el catálogo' }
    }
    if (p.isKit) {
      return { input, productId: null, name: p.name, sku: p.sku, price: null, quantity, error: 'Es un KIT — no se puede anidar dentro de otro KIT' }
    }
    return { input, productId: p.id, name: p.name, sku: p.sku, price: p.price, quantity, error: null }
  })
}

/**
 * Parsea texto libre (lo que devuelve una IA de cotización: líneas con
 * código + cantidad) y extrae candidatos { sku, quantity }. Tolerante:
 * "ABC-123 x2", "2x ABC-123", "ABC-123 (2 unidades)", "ABC-123", etc.
 */
export function parsePastedCodes(text: string): ComponentInput[] {
  const out: ComponentInput[] = []
  const seen = new Set<string>()

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.length < 3) continue

    // cantidad: "x2", "2x", "x 2", "cant: 2", "(2 u)", "2 unidades"
    let quantity = 1
    const qMatch =
      line.match(/(?:^|\s)x\s*(\d{1,3})(?:\s|$)/i) ||
      line.match(/(?:^|\s)(\d{1,3})\s*x(?:\s|$)/i) ||
      line.match(/cant[.:]?\s*(\d{1,3})/i) ||
      line.match(/\((\d{1,3})\s*(?:u|un|unid|unidades?)\)/i) ||
      line.match(/\b(\d{1,3})\s*(?:u|un|unid|unidades?)\b/i)
    if (qMatch) quantity = Math.max(1, Math.min(999, Number(qMatch[1])))

    // código: token alfanumérico con guiones/barras/puntos, al menos 4 chars,
    // con al menos un dígito o dos mayúsculas seguidas (evita agarrar
    // palabras sueltas como "camara" o "instalacion").
    const codeMatches = line.match(/\b[A-Za-z0-9][A-Za-z0-9._/\-]{3,}\b/g) ?? []
    const code = codeMatches
      .filter((c) => /\d/.test(c) || /[A-Z]{2,}/.test(c))
      .filter((c) => !/^\d{1,3}$/.test(c)) // no es sólo la cantidad
      .sort((a, b) => b.length - a.length)[0]

    if (!code) continue
    const key = code.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ sku: code, quantity })
  }

  return out
}
