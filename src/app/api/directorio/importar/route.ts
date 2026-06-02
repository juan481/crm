import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

    if (rows.length === 0) return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })

    const db = prisma as any
    const orgId = payload.orgId

    let empresasCreadas   = 0
    let empresasExistentes = 0
    let contactosCreados  = 0
    let filasOmitidas     = 0

    for (const row of rows) {
      const str = (key: string) => (row[key] ?? '').toString().trim()

      const empresaName = str('Empresa')
      const firstName   = str('Nombre')
      const lastName    = str('Apellido')

      // Necesitamos al menos empresa y nombre para procesar la fila
      if (!empresaName || !firstName) { filasOmitidas++; continue }

      // ── Upsert empresa ─────────────────────────────────────────────────
      let empresa = await db.empresa.findFirst({
        where: {
          organizationId: orgId,
          name: { equals: empresaName, mode: 'insensitive' },
        },
        select: { id: true },
      })

      if (!empresa) {
        empresa = await db.empresa.create({
          data: {
            organizationId: orgId,
            name:         empresaName,
            activity:     str('Actividad')        || null,
            address:      str('Domicilio Laboral') || null,
            codigoPostal: str('Codigo Postal')    || null,
            city:         str('Localidad')        || null,
            province:     str('Provincia')        || null,
            country:      str('Pais')             || null,
            website:      str('Web')              || null,
          },
          select: { id: true },
        })
        empresasCreadas++
      } else {
        empresasExistentes++
      }

      // ── Crear contacto (solo si no existe ya) ────────────────────────
      const email = str('Mail').toLowerCase() || null

      // Buscar duplicado: mismo email en la org, o mismo nombre+apellido en la misma empresa
      const dupWhere = email
        ? { organizationId: orgId, email }
        : { organizationId: orgId, firstName, lastName: lastName || '', empresaId: empresa.id }

      const existing = await db.directorioContacto.findFirst({
        where: dupWhere,
        select: { id: true },
      })

      if (existing) { filasOmitidas++; continue }

      await db.directorioContacto.create({
        data: {
          organizationId: orgId,
          firstName,
          lastName:   lastName   || null,
          companyRaw: empresaName,
          role:       str('Cargo')    || null,
          email,
          phone:      str('Telefono') || null,
          empresaId:  empresa.id,
        },
      })
      contactosCreados++
    }

    return NextResponse.json({
      message: `Importación completa`,
      empresasCreadas,
      empresasExistentes,
      contactosCreados,
      filasOmitidas,
    })
  } catch (error) {
    console.error('[DIRECTORIO IMPORTAR]', error)
    return NextResponse.json({ error: 'Error al procesar el archivo' }, { status: 500 })
  }
}
