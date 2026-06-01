import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

// ── POST: bulk import clients ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos para importar clientes' }, { status: 403 })
    }

    const { clients } = await req.json()
    if (!Array.isArray(clients) || clients.length === 0) {
      return NextResponse.json({ error: 'Se requiere un array de clientes' }, { status: 400 })
    }

    const MAX_IMPORT = 2000
    if (clients.length > MAX_IMPORT) {
      return NextResponse.json({ error: `Máximo ${MAX_IMPORT} clientes por importación` }, { status: 400 })
    }

    // ── Parse and validate rows ──────────────────────────────────────────
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    type ValidRow = {
      email: string
      name: string
      phone: string | null
      company: string | null
      country: string | null
      city: string | null
      tags: string
    }
    const valid: ValidRow[] = []
    let skipped = 0

    for (const row of clients) {
      const email = String(row.email ?? '').trim().toLowerCase()
      const name  = String(row.name  ?? '').trim()
      if (!email || !name || !emailRe.test(email)) { skipped++; continue }
      valid.push({
        email,
        name,
        phone:   row.phone   ? String(row.phone).trim()   : null,
        company: row.company ? String(row.company).trim() : null,
        country: row.country ? String(row.country).trim() : null,
        city:    row.city    ? String(row.city).trim()    : null,
        tags:    JSON.stringify(row.position ? [String(row.position).trim()] : []),
      })
    }

    if (valid.length === 0) {
      return NextResponse.json({
        message: `0 contactos importados. ${skipped} omitidos.`,
        created: 0, skipped, errors: [],
      })
    }

    // ── Fetch all existing emails in ONE query (replaces N findFirst calls) ──
    const incomingEmails = valid.map((r) => r.email)
    const existing = await prisma.client.findMany({
      where: { email: { in: incomingEmails }, organizationId: payload.orgId },
      select: { email: true },
    })
    const existingSet = new Set(existing.map((c) => c.email))

    const toCreate = valid.filter((r) => !existingSet.has(r.email))
    skipped += valid.length - toCreate.length

    if (toCreate.length === 0) {
      return NextResponse.json({
        message: `0 contactos importados. ${skipped} omitidos (ya existen).`,
        created: 0, skipped, errors: [],
      })
    }

    // ── createMany in ONE query (replaces N create calls) ───────────────
    const result = await prisma.client.createMany({
      data: toCreate.map((r) => ({
        name:           r.name,
        email:          r.email,
        phone:          r.phone,
        company:        r.company,
        country:        r.country,
        city:           r.city,
        status:         'PROSPECT' as const,
        clientType:     'B2B' as const,
        tags:           r.tags,
        organizationId: payload.orgId,
      })),
      skipDuplicates: true,
    })

    const created = result.count

    return NextResponse.json({
      message: `${created} contacto${created !== 1 ? 's' : ''} importado${created !== 1 ? 's' : ''}. ${skipped} omitido${skipped !== 1 ? 's' : ''}.`,
      created,
      skipped,
      errors: [],
    })
  } catch (error) {
    console.error('[BULK IMPORT]', error)
    return NextResponse.json({ error: 'Error al importar clientes' }, { status: 500 })
  }
}

// ── DELETE: bulk delete clients ───────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos para eliminar clientes' }, { status: 403 })
    }

    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Se requiere un array de IDs' }, { status: 400 })
    }

    const { count } = await prisma.client.deleteMany({
      where: { id: { in: ids }, organizationId: payload.orgId },
    })

    return NextResponse.json({
      message: `${count} cliente${count !== 1 ? 's' : ''} eliminado${count !== 1 ? 's' : ''}`,
      count,
    })
  } catch (error) {
    console.error('[BULK DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar clientes' }, { status: 500 })
  }
}
