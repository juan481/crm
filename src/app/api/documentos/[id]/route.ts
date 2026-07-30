import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'uploads'

// Derives the storage object path from the full public URL — only needed as
// a fallback for documents uploaded before `storagePath` existed.
function pathFromPublicUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  return idx === -1 ? null : url.slice(idx + marker.length)
}

interface Params { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { name, tags } = await req.json()

    const result = await prisma.document.updateMany({
      where: { id: params.id, organizationId: payload.orgId },
      data: {
        ...(name && { name }),
        ...(tags !== undefined && { tags: JSON.stringify(tags) }),
      },
    })
    if (result.count === 0) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

    const document = await prisma.document.findUnique({ where: { id: params.id } })
    return NextResponse.json({ data: document })
  } catch (error) {
    console.error('[DOC PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const doc = await prisma.document.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
    })

    if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

    const storagePath = doc.storagePath ?? pathFromPublicUrl(doc.url)
    if (storagePath) {
      const supabase = createAdminClient()
      const { error: removeError } = await supabase.storage.from(BUCKET).remove([storagePath])
      // No bloquea el borrado del registro por un error de storage (ej. ya
      // no existe), pero sí queda logueado para poder limpiarlo a mano.
      if (removeError) console.error('[DOC DELETE] Storage remove failed:', removeError)
    }

    await prisma.document.delete({ where: { id: params.id } })

    return NextResponse.json({ message: 'Documento eliminado' })
  } catch (error) {
    console.error('[DOC DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
