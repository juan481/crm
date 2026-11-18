import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canUseBases, cleanBaseName, findOrgBase } from '@/lib/contacto-bases'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

// PATCH /api/contactos/bases/[id] { name?, description? } — renombrar.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await canUseBases(payload.orgId, payload.role))) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const base = await findOrgBase(payload.orgId, params.id)
    if (!base) return NextResponse.json({ error: 'Base no encontrada' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}
    if (body?.name !== undefined) {
      const name = cleanBaseName(body.name)
      if (name.length < 2) return NextResponse.json({ error: 'El nombre tiene que tener al menos 2 letras' }, { status: 400 })
      const clash = await db.contactoBase.findFirst({
        where: { organizationId: payload.orgId, name: { equals: name, mode: 'insensitive' }, id: { not: base.id } },
        select: { id: true },
      })
      if (clash) return NextResponse.json({ error: 'Ya existe otra base con ese nombre' }, { status: 409 })
      data.name = name
    }
    if (body?.description !== undefined) {
      data.description = typeof body.description === 'string' && body.description.trim() ? body.description.trim().slice(0, 300) : null
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })

    const updated = await db.contactoBase.update({ where: { id: base.id }, data, select: { id: true, name: true, description: true } })
    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[CONTACTO BASE PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar la base' }, { status: 500 })
  }
}

// DELETE /api/contactos/bases/[id] — borra la base (los contactos quedan). Sólo Admin+.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sólo un administrador puede borrar bases' }, { status: 403 })

    const base = await findOrgBase(payload.orgId, params.id)
    if (!base) return NextResponse.json({ error: 'Base no encontrada' }, { status: 404 })

    await db.contactoBase.delete({ where: { id: base.id } })
    return NextResponse.json({ ok: true, message: `Base "${base.name}" eliminada. Los contactos no se borraron.` })
  } catch (error) {
    console.error('[CONTACTO BASE DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar la base' }, { status: 500 })
  }
}
