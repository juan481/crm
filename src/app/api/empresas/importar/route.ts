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
    let updated = 0
    let skipped = 0

    // Normalize a row's keys to lowercase+trimmed for case-insensitive column matching
    const normalizeRow = (row: Record<string, string>): Record<string, string> => {
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(row)) out[k.toLowerCase().trim()] = String(v ?? '')
      return out
    }

    // Pick first truthy value from a list of possible column names (already normalized to lowercase)
    const col = (r: Record<string, string>, ...keys: string[]) =>
      keys.map(k => r[k]).find(v => v?.trim()) ?? ''

    for (const rawRow of rows) {
      const row = normalizeRow(rawRow)

      const name = col(row, 'empresa', 'company', 'razon social', 'razón social', 'nombre').trim()
      if (!name) { skipped++; continue }

      const activity = col(row, 'actividad', 'rubro', 'actividad comercial', 'sector', 'industry').trim() || null
      const address  = col(row, 'domicilio', 'direccion', 'dirección', 'address').trim() || null
      const city     = col(row, 'localidad', 'ciudad', 'city').trim() || null
      const province = col(row, 'provincia', 'province').trim() || null
      const website  = col(row, 'web', 'website', 'sitio web', 'url').trim() || null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = await (prisma.empresa as any).findFirst({
        where: { organizationId: payload.orgId, name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
      })

      if (existing) {
        // Update only fields that have a value in the Excel row (don't overwrite with empty)
        const patch: Record<string, unknown> = {}
        if (activity) patch.activity = activity
        if (address)  patch.address  = address
        if (city)     patch.city     = city
        if (province) patch.province = province
        if (website)  patch.website  = website

        if (Object.keys(patch).length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (prisma.empresa as any).update({ where: { id: existing.id }, data: patch })
          updated++
        } else {
          skipped++
        }
        continue
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma.empresa as any).create({
        data: { organizationId: payload.orgId, name, activity, address, city, province, website },
      })
      created++
    }

    const parts = [`${created} creadas`]
    if (updated > 0) parts.push(`${updated} actualizadas`)
    if (skipped > 0) parts.push(`${skipped} sin cambios`)
    return NextResponse.json({ message: parts.join(', ') })
  } catch (error) {
    console.error('[EMPRESAS IMPORTAR]', error)
    return NextResponse.json({ error: 'Error al procesar el archivo' }, { status: 500 })
  }
}
