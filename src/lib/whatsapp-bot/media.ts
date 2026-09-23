import { createAdminClient } from '@/lib/supabase/admin'

// Descarga un adjunto de WhatsApp (imagen/audio/documento/video/sticker) y
// lo re-sube a Supabase Storage — mismo bucket que ya usan tareas/tickets
// (ver src/app/api/tareas/[id]/upload/route.ts). Necesario porque la URL
// que da la Media API de Meta es TEMPORAL (vence en minutos/horas) y exige
// el token de la app para descargarla — no se puede guardar esa URL tal
// cual ni mostrarla directo en el inbox.
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'uploads'
const GRAPH_VERSION = 'v23.0' // mismo que send.ts

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/amr': 'amr',
  'video/mp4': 'mp4', 'video/3gpp': '3gp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
}

export interface StoredMedia {
  url: string
  mimeType: string
}

// Falla suave en TODOS los pasos: si algo sale mal (token vencido, media
// borrada del lado de Meta, bucket sin permisos), devuelve null y el
// llamador sigue con el placeholder de texto de siempre — nunca bloquea el
// mensaje entrante por esto.
export async function downloadAndStoreWhatsAppMedia(
  apiToken: string,
  mediaId: string,
  orgId: string,
  conversationId: string,
): Promise<StoredMedia | null> {
  try {
    const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
    if (!metaRes.ok) {
      console.error('[NISSI MEDIA] no se pudo resolver el media id', mediaId, metaRes.status, await metaRes.text().catch(() => ''))
      return null
    }
    const meta = await metaRes.json() as { url?: string; mime_type?: string; file_size?: number }
    if (!meta.url) return null

    // Meta cobra estos GETs como parte del uso normal de la Cloud API — no
    // hay límite de tamaño propio acá, pero Supabase Storage (plan free)
    // sí lo tiene; 25MB cubre de sobra fotos/audios/documentos típicos de
    // WhatsApp (que ya limita a 16MB / 100MB según tipo del lado del cliente).
    if (meta.file_size && meta.file_size > 25 * 1024 * 1024) {
      console.warn('[NISSI MEDIA] archivo demasiado grande, se omite', mediaId, meta.file_size)
      return null
    }

    const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${apiToken}` } })
    if (!fileRes.ok) {
      console.error('[NISSI MEDIA] no se pudo descargar el archivo', mediaId, fileRes.status)
      return null
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer())
    const mimeType = meta.mime_type ?? fileRes.headers.get('content-type') ?? 'application/octet-stream'
    const ext = EXT_BY_MIME[mimeType] ?? mimeType.split('/')[1]?.split(';')[0] ?? 'bin'

    const path = `whatsapp/${orgId}/${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const supabase = createAdminClient()
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: mimeType })
    if (uploadError) {
      console.error('[NISSI MEDIA] error subiendo a Storage', uploadError)
      return null
    }
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return { url: publicUrl, mimeType }
  } catch (err) {
    console.error('[NISSI MEDIA] falló la descarga/subida', err)
    return null
  }
}
