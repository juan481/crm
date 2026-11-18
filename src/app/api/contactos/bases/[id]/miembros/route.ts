import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { addContactosToBase, canUseBases, findOrgBase } from '@/lib/contacto-bases'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

// POST /api/contactos/bases/[id]/miembros { contactoIds: string[], action: 'add' | 'remove' }
// Asignación manual (desde la ficha del contacto). Sólo acepta contactos de
// la misma organización — los ids ajenos se ignoran en silencio.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await canUseBases(payload.orgId, payload.role))) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const base = await findOrgBase(payload.orgId, params.id)
    if (!base) return NextResponse.json({ error: 'Base no encontrada' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const action = body?.action === 'remove' ? 'remove' : 'add'
    const rawIds: unknown[] = Array.isArray(body?.contactoIds) ? body.contactoIds : []
    const ids = rawIds.filter((x): x is string => typeof x === 'string' && x.length > 0).slice(0, 50000)
    if (ids.length === 0) return NextResponse.json({ error: 'No se recibieron contactos' }, { status: 400 })

    const valid = await db.directorioContacto.findMany({
      where: { id: { in: ids }, organizationId: payload.orgId },
      select: { id: true },
    })
    const validIds: string[] = valid.map((c: { id: string }) => c.id)

    if (action === 'remove') {
      const res = await db.contactoBaseMiembro.deleteMany({ where: { baseId: base.id, contactoId: { in: validIds } } })
      return NextResponse.json({ ok: true, removed: res.count })
    }
    const added = await addContactosToBase(base.id, validIds)
    return NextResponse.json({ ok: true, added, alreadyIn: validIds.length - added })
  } catch (error) {
    console.error('[CONTACTO BASE MIEMBROS]', error)
    return NextResponse.json({ error: 'Error al actualizar la base' }, { status: 500 })
  }
}
