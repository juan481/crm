import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserAny } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { prisma } from '@/lib/db'

// Mismo patrón que /api/settings/branding/logo (subida de logo de la
// organización) — bucket, validaciones y manejo de errores calcados; acá
// es la foto de PERFIL de un usuario, no el logo de marca. No acepta SVG a
// propósito (tiene sentido para un logo vectorial, no para una foto).
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'uploads'

// getCurrentUserAny() — mismo motivo que api/auth/mi-perfil/route.ts:
// sólo toca el propio registro del que llama, seguro para cualquier rol.
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUserAny()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[AVATAR UPLOAD] SUPABASE_SERVICE_ROLE_KEY not set')
      return NextResponse.json({ error: 'Storage no configurado. Contacte al administrador.' }, { status: 500 })
    }

    const formData = await req.formData()
    const file = formData.get('avatar') as File | null
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no válido. Usá PNG, JPG o WEBP' }, { status: 400 })
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'La imagen debe ser menor a 2MB' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    // {userId}-{timestamp}: el timestamp invalida cualquier caché del
    // navegador de la URL vieja (Supabase Storage no versiona por sí solo)
    // sin necesitar upsert sobre el mismo path.
    const path = `avatars/${payload.userId}-${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const supabase = createAdminClient()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (uploadError) {
      console.error('[AVATAR UPLOAD] Storage error:', uploadError)
      const msg = uploadError.message?.toLowerCase().includes('bucket')
        ? `Bucket "${BUCKET}" no existe en Supabase Storage. Contactá al administrador.`
        : `Error al subir la foto: ${uploadError.message}`
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

    const user = await prisma.user.update({
      where: { id: payload.userId },
      data: { avatarUrl: publicUrl },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true },
    })

    return NextResponse.json({ data: user })
  } catch (error) {
    console.error('[AVATAR UPLOAD]', error)
    return NextResponse.json({ error: 'Error al subir la foto' }, { status: 500 })
  }
}
