import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'uploads'

// Deriva el path del objeto en Supabase Storage a partir de la URL pública
// — sólo hace falta como fallback para documentos subidos antes de que
// existiera `storagePath`. Mismo helper que ya vivía duplicado en
// src/app/api/documentos/[id]/route.ts.
function pathFromPublicUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  return idx === -1 ? null : url.slice(idx + marker.length)
}

/**
 * Borra del storage real los archivos de una lista de Document — para
 * cuando se borra algo que CASCADEA la fila de Document en la DB sin pasar
 * por DELETE /api/documentos/[id] (ej. borrar un Vigilador borra su legajo
 * entero por onDelete: Cascade, ver schema.prisma). Sin esto, los archivos
 * quedaban huérfanos en el bucket para siempre aunque la fila de la DB ya
 * no existiera (bug real encontrado en code-review).
 */
export async function deleteDocumentsFromStorage(docs: { storagePath: string | null; url: string }[]): Promise<void> {
  const paths = docs.map((d) => d.storagePath ?? pathFromPublicUrl(d.url)).filter((p): p is string => !!p)
  if (paths.length === 0) return
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.storage.from(BUCKET).remove(paths)
    if (error) console.error('[DOCUMENT STORAGE] remove falló:', error)
  } catch (err) {
    console.error('[DOCUMENT STORAGE] remove falló:', err)
  }
}
