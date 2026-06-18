import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { findEmpresaMatch } from '@/lib/directorio-link'

export const dynamic = 'force-dynamic'

interface ImportRow {
  Nombre?:   string; nombre?:   string
  Apellido?: string; apellido?: string
  Empresa?:  string; empresa?:  string
  Cargo?:    string; cargo?:    string
  Mail?:     string; mail?:     string; Email?: string
  Teléfono?: string; Telefono?: string; telefono?: string
  [key: string]: unknown
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json() as { rows: ImportRow[] }
    const rows = body.rows ?? []
    if (rows.length === 0) return NextResponse.json({ error: 'No se recibieron filas' }, { status: 400 })

    const db    = prisma as any
    const orgId = payload.orgId

    const empresas = await db.empresa.findMany({
      where:  { organizationId: orgId },
      select: { id: true, name: true, website: true },
    })

    let created = 0
    let dupes   = 0
    let skipped = 0

    for (const row of rows) {
      try {
        const str = (keys: string[]) => {
          for (const k of keys) {
            const v = (row[k] ?? '').toString().trim()
            if (v) return v
          }
          return ''
        }

        const firstName = str(['Nombre', 'nombre'])
        const lastName  = str(['Apellido', 'apellido'])
        if (!firstName || !lastName) { skipped++; continue }

        const companyRaw = str(['Empresa', 'empresa'])   || null
        const role       = str(['Cargo', 'cargo'])        || null
        const email      = str(['Mail', 'mail', 'Email']).toLowerCase() || null
        const phone      = str(['Teléfono', 'Telefono', 'telefono'])    || null

        const existing = await db.directorioContacto.findFirst({
          where: email
            ? { organizationId: orgId, email }
            : { organizationId: orgId, firstName, lastName },
          select: { id: true },
        })
        if (existing) { dupes++; continue }

        const empresaId = findEmpresaMatch(email, companyRaw, empresas)

        await db.directorioContacto.create({
          data: { organizationId: orgId, firstName, lastName, companyRaw, role, email, phone, empresaId },
        })
        created++
      } catch {
        skipped++
      }
    }

    return NextResponse.json({ created, dupes, skipped })
  } catch (error) {
    console.error('[CONTACTOS IMPORTAR]', error)
    return NextResponse.json({ error: 'Error al procesar el lote' }, { status: 500 })
  }
}
