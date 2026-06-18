import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { findEmpresaMatch } from '@/lib/directorio-link'
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
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })

    if (rows.length === 0) return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })

    // Load all empresas once for batch linking
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const empresas = await (prisma as any).empresa.findMany({
      where: { organizationId: payload.orgId },
      select: { id: true, name: true, website: true },
    })

    let created  = 0
    let skipped  = 0
    let dupes    = 0

    for (const row of rows) {
      const firstName = (row['Nombre']   ?? row['nombre']   ?? '').toString().trim()
      const lastName  = (row['Apellido'] ?? row['apellido'] ?? '').toString().trim()
      if (!firstName || !lastName) { skipped++; continue }

      const companyRaw = (row['Empresa']  ?? row['empresa']  ?? '').toString().trim() || null
      const role       = (row['Cargo']    ?? row['cargo']    ?? '').toString().trim() || null
      const email      = (row['Mail']     ?? row['mail']     ?? row['Email'] ?? '').toString().trim().toLowerCase() || null
      const phone      = (row['Teléfono'] ?? row['Telefono'] ?? row['telefono'] ?? '').toString().trim() || null

      // Duplicate check: same email in this org, or same first+last name if no email
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = prisma as any
      const existing = await db.directorioContacto.findFirst({
        where: email
          ? { organizationId: payload.orgId, email }
          : { organizationId: payload.orgId, firstName, lastName },
        select: { id: true },
      })
      if (existing) { dupes++; continue }

      const empresaId = findEmpresaMatch(email, companyRaw, empresas)

      await db.directorioContacto.create({
        data: {
          organizationId: payload.orgId,
          firstName,
          lastName,
          companyRaw,
          role,
          email,
          phone,
          empresaId,
        },
      })
      created++
    }

    const parts = [`${created} contactos importados`]
    if (dupes   > 0) parts.push(`${dupes} duplicados omitidos`)
    if (skipped > 0) parts.push(`${skipped} filas sin nombre omitidas`)
    return NextResponse.json({ message: parts.join(', ') })
  } catch (error) {
    console.error('[CONTACTOS IMPORTAR]', error)
    return NextResponse.json({ error: 'Error al procesar el archivo' }, { status: 500 })
  }
}
