import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'uploads'

// Subida de imágenes para el editor de campañas de email. A diferencia de
// /api/documentos/upload, NO crea una fila Document (esas imágenes no son
// documentos del cliente, sólo assets de un mail) — sólo deja el archivo en
// storage y devuelve la URL pública. El cliente ya comprime antes de subir
// (ver image-link-modal.tsx); el tope de acá es una red de seguridad.
const MAX_SIZE = 1 * 1024 * 1024 // 1MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Storage no configurado. Contactá al administrador.' }, { status: 500 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no permitido. Usá JPG, PNG, WEBP o GIF.' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'La imagen supera 1MB — probá con una más liviana.' }, { status: 400 })
    }

    const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    const path = `email-images/${payload.orgId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const supabase = createAdminClient()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      const msg = /bucket/i.test(uploadError.message || '')
        ? `Bucket "${BUCKET}" no existe en Supabase Storage. Crealo desde el panel de Supabase.`
        : `Error al subir la imagen: ${uploadError.message}`
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ data: { url: publicUrl } })
  } catch (error) {
    console.error('[EMAIL IMAGE UPLOAD]', error)
    return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })
  }
}
