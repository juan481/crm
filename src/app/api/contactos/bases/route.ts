import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { canUseBases, cleanBaseName, findOrCreateBase, listBasesWithCounts } from '@/lib/contacto-bases'

export const dynamic = 'force-dynamic'

// GET /api/contactos/bases — bases de la org con conteos (total / con email).
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await canUseBases(payload.orgId, payload.role))) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    return NextResponse.json({ data: await listBasesWithCounts(payload.orgId) })
  } catch (error) {
    console.error('[CONTACTO BASES GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST /api/contactos/bases { name, description? } — crea la base, o devuelve
// la existente si ya hay una con ese nombre (existing: true).
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await canUseBases(payload.orgId, payload.role))) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const name = cleanBaseName(body?.name)
    if (name.length < 2) return NextResponse.json({ error: 'Poné un nombre para la base (mínimo 2 letras)' }, { status: 400 })
    const description = typeof body?.description === 'string' ? body.description.slice(0, 300) : null

    const { base, created } = await findOrCreateBase(payload.orgId, name, description)
    return NextResponse.json({ data: base, existing: !created }, { status: created ? 201 : 200 })
  } catch (error) {
    console.error('[CONTACTO BASES POST]', error)
    return NextResponse.json({ error: 'Error al crear la base' }, { status: 500 })
  }
}
