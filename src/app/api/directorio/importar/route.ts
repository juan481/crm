import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface ImportRow {
  Nombre?: string
  Apellido?: string
  Empresa?: string
  Cargo?: string
  Actividad?: string
  Mail?: string
  Telefono?: string | number
  'Domicilio Laboral'?: string
  'Codigo Postal'?: string | number
  Localidad?: string
  Provincia?: string
  Pais?: string
  Web?: string
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

    let empresasCreadas    = 0
    let empresasExistentes = 0
    let contactosCreados   = 0
    let filasOmitidas      = 0

    for (const row of rows) {
      try {
        const str = (key: string) => (row[key] ?? '').toString().trim()

        const empresaName = str('Empresa')
        const firstName   = str('Nombre')

        if (!empresaName || !firstName) { filasOmitidas++; continue }

        // Upsert empresa
        let empresa = await db.empresa.findFirst({
          where: { organizationId: orgId, name: { equals: empresaName, mode: 'insensitive' } },
          select: { id: true },
        })

        if (!empresa) {
          empresa = await db.empresa.create({
            data: {
              organizationId: orgId,
              name:         empresaName,
              activity:     str('Actividad')         || null,
              address:      str('Domicilio Laboral') || null,
              codigoPostal: str('Codigo Postal')     || null,
              city:         str('Localidad')         || null,
              province:     str('Provincia')         || null,
              country:      str('Pais')              || null,
              website:      str('Web')               || null,
            },
            select: { id: true },
          })
          empresasCreadas++
        } else {
          empresasExistentes++
        }

        // Dedup contacto
        const email    = str('Mail').toLowerCase() || null
        const lastName = str('Apellido') || null
        const dupWhere = email
          ? { organizationId: orgId, email }
          : { organizationId: orgId, firstName, lastName: lastName ?? '', empresaId: empresa.id }

        const existing = await db.directorioContacto.findFirst({ where: dupWhere, select: { id: true } })

        if (existing) { filasOmitidas++; continue }

        await db.directorioContacto.create({
          data: {
            organizationId: orgId,
            firstName,
            lastName,
            companyRaw:  empresaName,
            role:        str('Cargo')    || null,
            email,
            phone:       str('Telefono') || null,
            empresaId:   empresa.id,
          },
        })
        contactosCreados++
      } catch (rowErr) {
        // Fila individual falla → omitir y continuar con el resto
        console.error('[DIRECTORIO IMPORTAR] row error:', rowErr)
        filasOmitidas++
      }
    }

    return NextResponse.json({ empresasCreadas, empresasExistentes, contactosCreados, filasOmitidas })
  } catch (error) {
    console.error('[DIRECTORIO IMPORTAR]', error)
    return NextResponse.json({ error: 'Error al procesar el lote' }, { status: 500 })
  }
}
