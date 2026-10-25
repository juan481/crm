import { createAdminClient } from '@/lib/supabase/admin'

// CVs que llegan por WhatsApp → carpeta "CVs" de Documentos — pedido de Abba
// (Seba, 25/10): "todo lo que es CV, una vez que el área lo reciba, que se
// guarde en una carpeta en Documentos". Se dispara cuando NISSI deriva a
// RRHH (create_rrhh_ticket) y también si el adjunto llega DESPUÉS de derivar
// (el clásico "ahí te mando el CV"). Idempotente: el destino en Storage sale
// del id del mensaje, así que correrlo dos veces no duplica nada.
//
// El archivo se COPIA (no se reusa el del chat): borrar el documento después
// borra su archivo de Storage (ver deleteDocumentsFromStorage) y rompería el
// adjunto en la conversación del inbox.

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'uploads'
export const CVS_FOLDER_NAME = 'CVs'
const CV_MEDIA_TYPES = ['document', 'image']

function pathFromPublicUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  return idx === -1 ? null : url.slice(idx + marker.length)
}

async function carpetaCvs(db: any, orgId: string): Promise<string> {
  const existente = await db.folder.findFirst({
    where: { organizationId: orgId, parentId: null, name: CVS_FOLDER_NAME },
    select: { id: true },
  })
  if (existente) return existente.id
  const nueva = await db.folder.create({ data: { name: CVS_FOLDER_NAME, organizationId: orgId }, select: { id: true } })
  return nueva.id
}

async function tamanio(url: string): Promise<number> {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return Number(res.headers.get('content-length')) || 0
  } catch {
    return 0
  }
}

/** Guarda en Documentos → CVs los adjuntos (documento/imagen) que mandó el
 *  cliente en esta conversación desde el último reinicio de contexto.
 *  Devuelve cuántos documentos NUEVOS se crearon. Falla suave por archivo. */
export async function guardarCvsDeConversacion(
  db: any,
  opts: { orgId: string; conversationId: string; personName: string | null; uploadedById: string; desde?: Date | null },
): Promise<number> {
  const adjuntos = await db.whatsAppMessage.findMany({
    where: {
      conversationId: opts.conversationId,
      role: 'user',
      mediaUrl: { not: null },
      mediaType: { in: CV_MEDIA_TYPES },
      ...(opts.desde ? { createdAt: { gte: opts.desde } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, mediaUrl: true, mediaMimeType: true, mediaFileName: true, createdAt: true },
  })
  if (adjuntos.length === 0) return 0

  const supabase = createAdminClient()
  let folderId: string | null = null
  let creados = 0
  for (const a of adjuntos) {
    try {
      const origen = pathFromPublicUrl(a.mediaUrl)
      if (!origen) continue
      const ext = origen.includes('.') ? origen.slice(origen.lastIndexOf('.') + 1) : 'bin'
      const destino = `documents/${opts.orgId}/cvs/${a.id}.${ext}`
      const ya = await db.document.findFirst({ where: { organizationId: opts.orgId, storagePath: destino }, select: { id: true } })
      if (ya) continue

      const { error } = await supabase.storage.from(BUCKET).copy(origen, destino)
      // "already exists": una corrida anterior copió el archivo pero no llegó
      // a crear la fila — se sigue y se crea ahora.
      if (error && !/exist/i.test(error.message)) {
        console.error('[CVS] no se pudo copiar el adjunto', origen, error.message)
        continue
      }
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(destino)

      folderId ??= await carpetaCvs(db, opts.orgId)
      const fecha = new Date(a.createdAt).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
      const original = a.mediaFileName || `cv.${ext}`
      await db.document.create({
        data: {
          name: `CV — ${opts.personName || 'Sin nombre'} (${fecha})`,
          originalName: original,
          mimeType: a.mediaMimeType || 'application/octet-stream',
          size: await tamanio(publicUrl),
          url: publicUrl,
          storagePath: destino,
          folderId,
          organizationId: opts.orgId,
          tags: JSON.stringify(['CV', 'WhatsApp']),
          uploadedById: opts.uploadedById,
        },
      })
      creados++
    } catch (err) {
      console.error('[CVS] no se pudo guardar el CV en Documentos', a.id, err)
    }
  }
  return creados
}
