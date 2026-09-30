import { prisma } from '@/lib/db'
export { computeSuggestedGremioPrice } from '@/lib/kit-pricing'

// Lógica compartida de productos KIT (Product.isKit=true + ProductComponent[]).
// Un KIT se cotiza como UNA línea con UN precio (Product.price, editable a
// mano). El desglose de componentes y el margen son SÓLO para la vista
// interna de Abba — al cliente final nunca se le muestra.
//
// Un componente puede ser un Product O un Service (mano de obra/instalación,
// pedido explícito de Abba para no tener que "simular" el service como un
// producto sin SKU). Cada renglón de ProductComponent usa EXACTAMENTE UNO de
// componentId/serviceComponentId — nunca ambos, nunca ninguno.

export const KIT_COMPONENT_SELECT = {
  id: true, quantity: true, componentId: true, serviceComponentId: true,
  component: {
    select: { id: true, name: true, sku: true, price: true, currency: true, costo: true, stock: true, trackStock: true, precioGremio: true },
  },
  serviceComponent: {
    select: { id: true, name: true, price: true, currency: true, billingCycle: true },
  },
} as const

export const KIT_SELECT = {
  id: true, name: true, description: true, price: true, currency: true, unit: true, precioGremio: true,
  isKit: true, active: true, trackStock: true, stock: true, organizationId: true, createdAt: true,
  kitComponents: { select: KIT_COMPONENT_SELECT, orderBy: { createdAt: 'asc' as const } },
} as const

interface RawKitComponent {
  quantity: number
  component: { price: number; currency: string; costo: number | null; stock: number; trackStock: boolean; precioGremio: number | null } | null
  serviceComponent: { price: number; currency: string; billingCycle: string } | null
}

interface RawKit {
  id: string; name: string; price: number; currency: string
  kitComponents: RawKitComponent[]
  [k: string]: unknown
}

// Un componente (Product o Service) leído en vivo, normalizado a los campos
// que importan para el cálculo de margen — Service no tiene costo/stock/
// precioGremio propios, así que quedan en su default "neutro".
function normalizeComponent(c: RawKitComponent) {
  if (c.component) {
    return {
      price: c.component.price, currency: c.component.currency, costo: c.component.costo,
      stock: c.component.stock, trackStock: c.component.trackStock, precioGremio: c.component.precioGremio,
    }
  }
  // serviceComponent: un servicio (mano de obra) nunca trackea stock ni tiene
  // costo/precioGremio propios — cotiza siempre a su mismo precio.
  return {
    price: c.serviceComponent?.price ?? 0, currency: c.serviceComponent?.currency ?? 'USD', costo: null,
    stock: 0, trackStock: false, precioGremio: null,
  }
}

/** Agrega subtotal de componentes, costo y margen a un KIT ya traído con KIT_SELECT. */
export function withKitMetrics<T extends RawKit>(kit: T) {
  const norm = kit.kitComponents.map((c) => ({ ...normalizeComponent(c), quantity: c.quantity }))
  const componentesSubtotal = norm.reduce((s, c) => s + c.price * c.quantity, 0)
  // Subtotal Gremio: para el componente que no tiene precioGremio propio (no
  // maneja dual-pricing, o es un Service) se usa su precio Público — no todo
  // el catálogo tiene ambos precios cargados.
  const componentesSubtotalGremio = norm.reduce((s, c) => s + (c.precioGremio ?? c.price) * c.quantity, 0)
  const componentesCosto = norm.reduce((s, c) => s + (c.costo ?? 0) * c.quantity, 0)
  const margen = kit.price - componentesSubtotal
  // Margen = ganancia sobre el PRECIO DE VENTA (definición contable estándar).
  const margenPct = kit.price > 0 ? (margen / kit.price) * 100 : 0
  // Marcación = ganancia sobre el COSTO (lo que la mayoría piensa como
  // "le pongo un X% arriba"). 40% de marcación == ~28,6% de margen.
  const marcacionPct = componentesSubtotal > 0 ? (margen / componentesSubtotal) * 100 : 0
  const algunComponenteSinStock = norm.some((c) => c.trackStock && c.stock < c.quantity)
  // Moneda de los componentes: si todos comparten una, es esa; si hay mezcla
  // o no hay componentes, null. Si no coincide con la del KIT, el
  // subtotal/margen mezclan monedas y no son reales.
  const monedas = Array.from(new Set(norm.map((c) => c.currency)))
  const componentesMoneda = monedas.length === 1 ? monedas[0] : null
  const monedaDesalineada = monedas.length > 1 || (componentesMoneda != null && componentesMoneda !== kit.currency)
  return {
    ...kit,
    componentesSubtotal, componentesSubtotalGremio, componentesCosto, margen, margenPct, marcacionPct,
    algunComponenteSinStock, componentesMoneda, monedaDesalineada,
  }
}

export interface ComponentInput {
  productId?: string
  serviceId?: string
  sku?: string
  quantity?: number
}

export interface ResolvedComponent {
  input: ComponentInput
  kind: 'PRODUCT' | 'SERVICE'
  productId: string | null
  serviceId: string | null
  name: string | null
  sku: string | null
  price: number | null
  precioGremio: number | null
  currency: string | null
  quantity: number
  error: string | null
}

/**
 * Resuelve una lista de componentes (por productId, serviceId o por SKU de
 * producto) contra el catálogo/servicios de la organización. Rechaza:
 * productos/servicios de otra org, productos que a su vez son KIT (no se
 * anidan KITs), y códigos que no existen. Un input con `serviceId` siempre se
 * resuelve como Service, aunque no matchee no cae al catálogo de productos.
 */
export async function resolveComponents(orgId: string, inputs: ComponentInput[]): Promise<ResolvedComponent[]> {
  const db = prisma as any

  const ids = inputs.map((i) => i.productId).filter(Boolean) as string[]
  const skus = inputs.map((i) => i.sku?.trim()).filter(Boolean) as string[]
  const serviceIds = inputs.map((i) => i.serviceId).filter(Boolean) as string[]

  const [byId, bySku, byServiceId] = await Promise.all([
    ids.length
      ? db.product.findMany({ where: { id: { in: ids }, organizationId: orgId }, select: { id: true, name: true, sku: true, price: true, currency: true, isKit: true, precioGremio: true } })
      : [],
    skus.length
      ? db.product.findMany({ where: { organizationId: orgId, sku: { in: skus } }, select: { id: true, name: true, sku: true, price: true, currency: true, isKit: true, precioGremio: true } })
      : [],
    serviceIds.length
      ? db.service.findMany({ where: { id: { in: serviceIds }, organizationId: orgId }, select: { id: true, name: true, price: true, currency: true } })
      : [],
  ])
  const idMap = new Map<string, any>(byId.map((p: any) => [p.id, p]))
  const skuMap = new Map<string, any>(bySku.map((p: any) => [String(p.sku).toLowerCase(), p]))
  const serviceMap = new Map<string, any>(byServiceId.map((s: any) => [s.id, s]))

  return inputs.map((input): ResolvedComponent => {
    const quantity = Math.max(1, Math.round(Number(input.quantity) || 1))

    if (input.serviceId) {
      const s = serviceMap.get(input.serviceId)
      if (!s) {
        return { input, kind: 'SERVICE', productId: null, serviceId: null, name: null, sku: null, price: null, precioGremio: null, currency: null, quantity, error: 'No se encontró el servicio' }
      }
      return { input, kind: 'SERVICE', productId: null, serviceId: s.id, name: s.name, sku: null, price: s.price, precioGremio: null, currency: s.currency, quantity, error: null }
    }

    const p = input.productId
      ? idMap.get(input.productId)
      : input.sku
        ? skuMap.get(input.sku.trim().toLowerCase())
        : null

    if (!p) {
      return { input, kind: 'PRODUCT', productId: null, serviceId: null, name: null, sku: input.sku ?? null, price: null, precioGremio: null, currency: null, quantity, error: 'No se encontró en el catálogo' }
    }
    if (p.isKit) {
      return { input, kind: 'PRODUCT', productId: null, serviceId: null, name: p.name, sku: p.sku, price: null, precioGremio: null, currency: null, quantity, error: 'Es un KIT — no se puede anidar dentro de otro KIT' }
    }
    return { input, kind: 'PRODUCT', productId: p.id, serviceId: null, name: p.name, sku: p.sku, price: p.price, precioGremio: p.precioGremio ?? null, currency: p.currency, quantity, error: null }
  })
}

/**
 * Parsea texto libre (lo que devuelve una IA de cotización: líneas con
 * código + cantidad) y extrae candidatos { sku, quantity }. Tolerante:
 * "ABC-123 x2", "2x ABC-123", "ABC-123 (2 unidades)", "ABC-123", etc.
 * Sólo detecta productos por SKU — los servicios no tienen código, se
 * agregan por buscador (ver kits-manager.tsx).
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
