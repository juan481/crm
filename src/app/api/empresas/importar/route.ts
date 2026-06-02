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
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })

    if (rows.length === 0) return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })

    let created = 0
    let skipped = 0

    for (const row of rows) {
      const name = (row['Empresa'] ?? row['empresa'] ?? row['EMPRESA'] ?? '').toString().trim()
      if (!name) { skipped++; continue }

      // Skip if already exists (by name + org)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = await (prisma.empresa as any).findFirst({
        where: { organizationId: payload.orgId, name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
      })
      if (existing) { skipped++; continue }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma.empresa as any).create({
        data: {
          organizationId: payload.orgId,
          name,
          activity: (row['Actividad'] ?? row['actividad'] ?? '').toString().trim() || null,
          address:  (row['Domicilio'] ?? row['domicilio'] ?? '').toString().trim() || null,
          city:     (row['Localidad'] ?? row['localidad'] ?? '').toString().trim() || null,
          province: (row['Provincia'] ?? row['provincia'] ?? '').toString().trim() || null,
          website:  (row['Web']       ?? row['web']       ?? '').toString().trim() || null,
        },
      })
      created++
    }

    return NextResponse.json({ message: `${created} empresas importadas, ${skipped} omitidas` })
  } catch (error) {
    console.error('[EMPRESAS IMPORTAR]', error)
    return NextResponse.json({ error: 'Error al procesar el archivo' }, { status: 500 })
  }
}
