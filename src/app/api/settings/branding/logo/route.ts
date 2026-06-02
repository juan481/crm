import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { prisma } from '@/lib/db'

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'uploads'

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (payload.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[LOGO UPLOAD] SUPABASE_SERVICE_ROLE_KEY not set')
      return NextResponse.json({ error: 'Storage no configurado. Contacte al administrador.' }, { status: 500 })
    }

    const formData = await req.formData()
    const file = formData.get('logo') as File | null

    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const validTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no válido. Use PNG, JPG o SVG' }, { status: 400 })
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo debe ser menor a 2MB' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const path = `logos/${payload.orgId}-${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const supabase = createAdminClient()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (uploadError) {
      console.error('[LOGO UPLOAD] Storage error:', uploadError)
      const msg = uploadError.message?.includes('bucket') || uploadError.message?.includes('Bucket')
        ? `Bucket "${BUCKET}" no existe en Supabase Storage. Crealo desde el panel de Supabase.`
        : `Error al subir logo: ${uploadError.message}`
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

    await prisma.organization.update({
      where: { id: payload.orgId },
      data: { logoUrl: publicUrl },
    })

    return NextResponse.json({ data: { logoUrl: publicUrl } })
  } catch (error) {
    console.error('[LOGO UPLOAD]', error)
    return NextResponse.json({ error: 'Error al subir logo' }, { status: 500 })
  }
}
