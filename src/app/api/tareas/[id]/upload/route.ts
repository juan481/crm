import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

const MAX_SIZE = 15 * 1024 * 1024
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'uploads'
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

// Dedicated upload path for task comments — same reasoning as
// /api/tickets/[id]/upload: not routed through /api/documentos/upload
// (SELLER+ only), a TECHNICIAN must be able to attach a photo to their own task.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = prisma as any
    const scopeWhere: Record<string, unknown> = { id: params.id, organizationId: payload.orgId }
    if (payload.role === 'TECHNICIAN') scopeWhere.assignedToId = payload.userId
    else if (['SELLER', 'HR'].includes(payload.role)) scopeWhere.OR = [{ assignedToId: payload.userId }, { createdById: payload.userId }]
    const task = await db.task.findFirst({ where: scopeWhere })
    if (!task) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[TASK UPLOAD] SUPABASE_SERVICE_ROLE_KEY not set')
      return NextResponse.json({ error: 'Storage no configurado. Contacte al administrador.' }, { status: 500 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no permitido. Use JPG, PNG o PDF' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo supera el límite de 15MB' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const path = `tareas/${payload.orgId}/${params.id}/${safeName}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const supabase = createAdminClient()
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: file.type })
    if (uploadError) {
      console.error('[TASK UPLOAD] Storage error:', uploadError)
      const msg = uploadError.message?.includes('bucket') || uploadError.message?.includes('Bucket')
        ? `Bucket "${BUCKET}" no existe en Supabase Storage. Crealo desde el panel de Supabase.`
        : `Error al subir archivo: ${uploadError.message}`
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ data: { url: publicUrl, name: file.name } }, { status: 201 })
  } catch (error) {
    console.error('[TASK UPLOAD]', error)
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 })
  }
}
