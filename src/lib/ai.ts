import { GoogleGenAI, Type } from '@google/genai'
import { getPluginConfig } from '@/lib/plugins'
import { DEFAULT_GEMINI_MODEL } from '@/lib/whatsapp-bot/nissi-shared'

// Acceso a Gemini para features que NO son NISSI (OCR de facturas de compra,
// etc.). La API key se comparte con el plugin whatsapp-ai-bot para no pedir
// otra credencial: quien ya configuró NISSI no configura nada nuevo. Fallback
// a GEMINI_API_KEY del entorno para orgs sin el plugin.

export class GeminiNoConfiguradoError extends Error {
  constructor() {
    super(
      'Falta la API key de Google Gemini. Configurala en Configuración → NISSI ' +
      '(se usa también para leer las facturas de compra).',
    )
    this.name = 'GeminiNoConfiguradoError'
  }
}

export async function getGeminiKey(orgId: string): Promise<string> {
  const cfg = await getPluginConfig(orgId, 'whatsapp-ai-bot')
  const fromPlugin = typeof cfg?.geminiApiKey === 'string' ? cfg.geminiApiKey.trim() : ''
  const key = fromPlugin || process.env.GEMINI_API_KEY?.trim() || ''
  if (!key) throw new GeminiNoConfiguradoError()
  return key
}

export async function getGeminiModel(orgId: string): Promise<string> {
  const cfg = await getPluginConfig(orgId, 'whatsapp-ai-bot')
  const m = typeof cfg?.geminiModel === 'string' ? cfg.geminiModel.trim() : ''
  return m || DEFAULT_GEMINI_MODEL
}

// ─── OCR de factura / remito de compra ────────────────────────────────────

export interface FacturaCompraItemOCR {
  codigo: string | null
  descripcion: string
  cantidad: number
  precioUnitario: number
  subtotal: number | null
}

export interface FacturaCompraOCR {
  proveedorNombre: string | null
  proveedorCuit: string | null
  numeroComprobante: string | null
  // 'FACTURA_A' | 'FACTURA_B' | 'FACTURA_C' | 'REMITO' | 'TICKET' | 'OTRO'
  tipoComprobante: string | null
  fecha: string | null      // ISO YYYY-MM-DD
  moneda: string | null     // 'ARS' | 'USD' | 'EUR'
  subtotal: number | null
  iva: number | null
  total: number | null
  items: FacturaCompraItemOCR[]
}

const FACTURA_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    proveedorNombre:   { type: Type.STRING, nullable: true, description: 'Razón social del proveedor / emisor de la factura' },
    proveedorCuit:     { type: Type.STRING, nullable: true, description: 'CUIT del proveedor, sólo dígitos o con guiones' },
    numeroComprobante: { type: Type.STRING, nullable: true, description: 'Número de factura/remito, ej "0001-00001234"' },
    tipoComprobante:   { type: Type.STRING, nullable: true, description: 'Uno de: FACTURA_A, FACTURA_B, FACTURA_C, REMITO, TICKET, OTRO' },
    fecha:             { type: Type.STRING, nullable: true, description: 'Fecha de emisión en formato YYYY-MM-DD' },
    moneda:            { type: Type.STRING, nullable: true, description: 'ARS, USD o EUR. Si no se indica, ARS' },
    subtotal:          { type: Type.NUMBER, nullable: true, description: 'Subtotal sin IVA (neto). Punto decimal.' },
    iva:               { type: Type.NUMBER, nullable: true, description: 'Monto total de IVA' },
    total:             { type: Type.NUMBER, nullable: true, description: 'Total final a pagar' },
    items: {
      type: Type.ARRAY,
      description: 'Renglones de la factura. Un objeto por producto/servicio.',
      items: {
        type: Type.OBJECT,
        properties: {
          codigo:         { type: Type.STRING, nullable: true, description: 'Código / SKU del proveedor si figura' },
          descripcion:    { type: Type.STRING, description: 'Descripción del renglón' },
          cantidad:       { type: Type.NUMBER, description: 'Cantidad (unidades)' },
          precioUnitario: { type: Type.NUMBER, description: 'Precio unitario sin IVA. Punto decimal.' },
          subtotal:       { type: Type.NUMBER, nullable: true, description: 'Subtotal del renglón (cantidad × precio)' },
        },
        required: ['descripcion', 'cantidad', 'precioUnitario'],
      },
    },
  },
  required: ['items'],
}

const OCR_PROMPT = `Sos un asistente que extrae datos de facturas y remitos de compra argentinos.
Te paso una imagen o PDF de un comprobante que un comercio de seguridad electrónica recibió de un proveedor.
Devolvé SOLO el JSON con los datos que puedas leer. Reglas:
- Números con punto decimal (1234.50), sin separador de miles, sin símbolo de moneda.
- Si un dato no está o no se lee con confianza, poné null (no inventes).
- items: un renglón por producto. Ignorá líneas de subtotales/percepciones/IVA dentro del detalle.
- precioUnitario y subtotal SIEMPRE sin IVA (neto).
- tipoComprobante: mirá la letra grande (A/B/C) → FACTURA_A/FACTURA_B/FACTURA_C. Si dice REMITO → REMITO. Ticket fiscal → TICKET. Otro → OTRO.`

/**
 * Lee una factura/remito de compra (imagen o PDF en base64) y devuelve los
 * datos estructurados. Tira GeminiNoConfiguradoError si falta la key; el
 * resto de los errores se propagan tal cual para que el endpoint los loguee.
 */
export async function extractFacturaCompra(
  orgId: string,
  fileBase64: string,
  mimeType: string,
): Promise<FacturaCompraOCR> {
  const apiKey = await getGeminiKey(orgId)
  const model = await getGeminiModel(orgId)
  const ai = new GoogleGenAI({ apiKey })

  const res = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          { text: OCR_PROMPT },
          { inlineData: { mimeType, data: fileBase64 } },
        ],
      },
    ],
    config: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: FACTURA_SCHEMA,
      maxOutputTokens: 4096,
    },
  })

  const text = (res.text
    ?? res.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('')
    ?? '').trim()
  if (!text) throw new Error('La IA no devolvió datos de la factura')

  let parsed: any
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('La IA devolvió una respuesta que no se pudo interpretar')
  }

  const num = (v: unknown): number | null => {
    const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN
    return Number.isFinite(n) ? n : null
  }
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

  const items: FacturaCompraItemOCR[] = Array.isArray(parsed.items)
    ? parsed.items
        .map((it: any) => ({
          codigo: str(it.codigo),
          descripcion: str(it.descripcion) ?? '',
          cantidad: num(it.cantidad) ?? 0,
          precioUnitario: num(it.precioUnitario) ?? 0,
          subtotal: num(it.subtotal),
        }))
        .filter((it: FacturaCompraItemOCR) => it.descripcion)
    : []

  return {
    proveedorNombre: str(parsed.proveedorNombre),
    proveedorCuit: str(parsed.proveedorCuit),
    numeroComprobante: str(parsed.numeroComprobante),
    tipoComprobante: str(parsed.tipoComprobante),
    fecha: str(parsed.fecha),
    moneda: str(parsed.moneda),
    subtotal: num(parsed.subtotal),
    iva: num(parsed.iva),
    total: num(parsed.total),
    items,
  }
}
