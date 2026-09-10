import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAdminClient } from '@/lib/supabase/admin'
import { puedeVerCompras } from '@/lib/stock-access'
import { extractFacturaCompra, GeminiNoConfiguradoError } from '@/lib/ai'
import { matchCompraItem, type ProductoParaMatch } from '@/lib/compra-match'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'uploads'
const MAX_SIZE = 20 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')

// POST /api/compras/ocr — sube la foto/PDF de una factura de compra, la lee
// con Gemini y devuelve la extracción + sugerencias de match (proveedor +
// producto por renglón). NO crea la Compra todavía — eso es /api/compras
// después de que la persona revisa la pantalla.
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Storage no configurado. Contactá al administrador.' }, { status: 500 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no permitido. Subí una foto (JPG/PNG) o un PDF de la factura.' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo supera 20MB — sacá la foto con menos resolución o comprimí el PDF.' }, { status: 400 })
    }

    let buffer: Buffer = Buffer.from(new Uint8Array(await file.arrayBuffer()))
    let mimeType = file.type
    let ext = (file.type.split('/')[1] || 'bin').replace('jpeg', 'jpg')

    // Foto: enderezar + bajar resolución antes de mandar a la IA y guardar
    // (una foto de celular de 8MB no aporta nada sobre 2200px y encarece el OCR).
    if (file.type.startsWith('image/')) {
      try {
        const sharp = (await import('sharp')).default
        const resized = await sharp(buffer).rotate().resize({ width: 2200, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer()
        buffer = Buffer.from(new Uint8Array(resized))
        mimeType = 'image/jpeg'
        ext = 'jpg'
      } catch (e) {
        console.error('[COMPRA OCR] sharp falló, se usa el original', e)
      }
    }

    // 1) Guardar el archivo como Document (para adjuntarlo a la compra).
    const path = `compras/${payload.orgId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const supabase = createAdminClient()
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: mimeType, upsert: false })
    if (upErr) {
      const msg = /bucket/i.test(upErr.message || '')
        ? `Bucket "${BUCKET}" no existe en Supabase Storage.`
        : `Error al subir el archivo: ${upErr.message}`
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const doc = await (prisma as any).document.create({
      data: {
        name: `Factura de compra ${new Date().toLocaleDateString('es-AR')}`,
        originalName: file.name,
        mimeType, size: buffer.length, url: publicUrl, storagePath: path,
        organizationId: payload.orgId,
        tags: JSON.stringify(['compra', 'factura']),
        uploadedById: payload.userId,
      },
      select: { id: true, url: true },
    })

    // 2) OCR.
    let ocr
    try {
      ocr = await extractFacturaCompra(payload.orgId, buffer.toString('base64'), mimeType)
    } catch (e) {
      if (e instanceof GeminiNoConfiguradoError) {
        return NextResponse.json({ error: e.message, documentoId: doc.id, documentUrl: doc.url }, { status: 422 })
      }
      console.error('[COMPRA OCR] Gemini', e)
      return NextResponse.json({
        error: 'No se pudo leer la factura automáticamente. Cargá los datos a mano — la imagen ya quedó adjunta.',
        documentoId: doc.id, documentUrl: doc.url,
      }, { status: 502 })
    }

    // 3) Sugerencias de match.
    const db = prisma as any
    const productos: ProductoParaMatch[] = await db.product.findMany({
      where: { organizationId: payload.orgId },
      select: { id: true, name: true, sku: true, mpn: true, costo: true, currency: true, trackStock: true, stock: true },
    })
    const productoById = new Map(productos.map((p) => [p.id, p]))

    const itemsConMatch = ocr.items.map((it) => {
      const match = matchCompraItem({ codigo: it.codigo, descripcion: it.descripcion }, productos)
      const prod = match.productId ? productoById.get(match.productId) : null
      return {
        ...it,
        match: {
          ...match,
          productName: prod?.name ?? null,
          productSku: prod?.sku ?? null,
          costoActual: prod?.costo ?? null,
          // Moneda en la que está guardado ese costo — para no comparar
          // peras con manzanas (costo en USD vs factura en ARS).
          costoMoneda: prod?.currency ?? null,
          trackStock: prod?.trackStock ?? false,
        },
      }
    })

    // 4) Proveedor sugerido — por CUIT exacto, si no por nombre.
    let proveedorSugerido: { id: string; name: string } | null = null
    const cuitDigits = digits(ocr.proveedorCuit)
    if (cuitDigits.length >= 8) {
      const rows = await db.empresa.findMany({
        where: { organizationId: payload.orgId, cuit: { not: null } },
        select: { id: true, name: true, cuit: true, esProveedor: true },
      })
      proveedorSugerido = rows.find((e: any) => digits(e.cuit) === cuitDigits) ?? null
    }
    if (!proveedorSugerido && ocr.proveedorNombre && ocr.proveedorNombre.length >= 3) {
      const byName = await db.empresa.findFirst({
        where: { organizationId: payload.orgId, name: { contains: ocr.proveedorNombre.split(/\s+/)[0], mode: 'insensitive' } },
        select: { id: true, name: true },
      })
      proveedorSugerido = byName ?? null
    }

    return NextResponse.json({
      data: {
        documentoId: doc.id,
        documentUrl: doc.url,
        ocr,
        proveedorSugerido,
        items: itemsConMatch,
      },
    })
  } catch (error) {
    console.error('[COMPRA OCR POST]', error)
    return NextResponse.json({ error: 'Error al procesar la factura' }, { status: 500 })
  }
}
