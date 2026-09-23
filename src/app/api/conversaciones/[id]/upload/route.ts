import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { roleHasModule } from '@/lib/module-access'
import { canReplyToConversations } from '@/lib/whatsapp-bot/permissions'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params { params: { id: string } }

// Tope propio, más chico que los límites de Meta (16MB imagen/audio, 100MB
// video/doc) — esto lo sube un agente desde el inbox, no hace falta llegar
// al máximo de WhatsApp y así se evita cargar Storage con archivos pesados.
const MAX_SIZE = 10 * 1024 * 1024
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'uploads'

// mime -> tipo de mensaje de WhatsApp (ver MEDIA_FIELD_BY_TYPE en send.ts)
const TYPE_BY_MIME: Record<string, string> = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image',
  'audio/ogg': 'audio', 'audio/mpeg': 'audio', 'audio/mp4': 'audio', 'audio/aac': 'audio', 'audio/amr': 'audio',
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
}

// Adjunto saliente: un agente manda una foto/PDF/audio a un cliente desde el
// inbox. Sin video (el caso menos común y el más pesado) — se puede sumar
// después si hace falta. Mismo patrón que tareas/[id]/upload.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER') && !(await roleHasModule(payload.orgId, payload.role, 'conversaciones'))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }
    if (!(await canReplyToConversations(payload.orgId, payload.role))) {
      return NextResponse.json({ error: 'Tu rol puede ver la bandeja pero no responder' }, { status: 403 })
    }

    const db = prisma as any
    const conv = await db.whatsAppConversation.findFirst({ where: { id: params.id, organizationId: payload.orgId }, select: { id: true } })
    if (!conv) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[CONVERSACION UPLOAD] SUPABASE_SERVICE_ROLE_KEY not set')
      return NextResponse.json({ error: 'Storage no configurado. Contacte al administrador.' }, { status: 500 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const mediaType = TYPE_BY_MIME[file.type]
    if (!mediaType) return NextResponse.json({ error: 'Formato no permitido. Use JPG, PNG, WEBP, PDF, Word, Excel o audio' }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'El archivo supera el límite de 10MB' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const path = `whatsapp-out/${payload.orgId}/${conv.id}/${safeName}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const supabase = createAdminClient()
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: file.type })
    if (uploadError) {
      console.error('[CONVERSACION UPLOAD] Storage error:', uploadError)
      return NextResponse.json({ error: `Error al subir archivo: ${uploadError.message}` }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({
      data: { url: publicUrl, mimeType: file.type, mediaType, fileName: file.name },
    }, { status: 201 })
  } catch (error) {
    console.error('[CONVERSACION UPLOAD]', error)
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 })
  }
}
