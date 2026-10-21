import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import { prisma } from '@/lib/db'
import { deleteDocumentsFromStorage } from '@/lib/document-storage'
import { canManageDocument } from '@/lib/document-access'

interface Params { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    // Rechazo rápido SIN consultar la DB para quien no tiene ningún acceso
    // de documentos — evita que alguien sin ningún permiso distinga 404 de
    // 403 probando ids ajenos (encontrado en code-review: el findFirst de
    // abajo corría ANTES de cualquier chequeo de rol).
    if (!canAccess(payload.role, 'SELLER') && !(await roleHasModule(payload.orgId, payload.role, 'legajos')))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const existing = await prisma.document.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true, legajoId: true },
    })
    if (!existing) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    if (!(await canManageDocument(payload.orgId, payload.role, existing))) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

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
    if (!canAccess(payload.role, 'SELLER') && !(await roleHasModule(payload.orgId, payload.role, 'legajos')))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const doc = await prisma.document.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
    })

    if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    if (!(await canManageDocument(payload.orgId, payload.role, doc))) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    // No bloquea el borrado del registro por un error de storage (ej. ya
    // no existe) — deleteDocumentsFromStorage ya loguea internamente.
    await deleteDocumentsFromStorage([doc])

    await prisma.document.delete({ where: { id: params.id } })

    return NextResponse.json({ message: 'Documento eliminado' })
  } catch (error) {
    console.error('[DOC DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
