import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { findEmpresaMatch } from '@/lib/directorio-link'
import { addContactosToBase, findOrgBase } from '@/lib/contacto-bases'

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
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json() as { rows: ImportRow[]; offset?: number; baseId?: string }
    const rows = body.rows ?? []
    if (rows.length === 0) return NextResponse.json({ error: 'No se recibieron filas' }, { status: 400 })
    const baseFila = (Number(body.offset) || 0) + 2

    const db    = prisma as any
    const orgId = payload.orgId

    // Base de contactos elegida al importar (opcional). Se valida contra la
    // org en cada lote — nunca confiar en el id que manda el navegador.
    const base = body.baseId ? await findOrgBase(orgId, body.baseId) : null
    if (body.baseId && !base) return NextResponse.json({ error: 'La base elegida no existe (¿la borraron?). Volvé a elegirla.' }, { status: 400 })
    // Contactos (nuevos Y repetidos) a sumar a la base: un repetido es la
    // misma persona que ya estaba en el CRM y también vino de este origen
    // (ej. visitante de Exposeg que ya era contacto).
    const idsParaBase: string[] = []

    const empresas = await db.empresa.findMany({
      where:  { organizationId: orgId },
      select: { id: true, name: true, website: true },
    })

    let created = 0
    let dupes   = 0
    let skipped = 0
    const omitidas: { fila: number; nombre: string; apellido: string; empresa: string; mail: string; motivo: string }[] = []

    const existingContacts = await db.directorioContacto.findMany({
      where: { organizationId: orgId },
      select: { id: true, firstName: true, lastName: true, empresaId: true }
    })
    const existingByKey = new Map<string, string>(existingContacts.map((c: any) => [`${c.firstName.toLowerCase()}|${c.lastName.toLowerCase()}|${c.empresaId || ''}`, c.id]))
    // Claves de filas de ESTE lote que se van a crear (todavía sin id).
    const pendingKeys = new Set<string>()

    const toCreate = []

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx]
      const filaExcel = baseFila + idx
      const str = (keys: string[]) => {
        for (const k of keys) {
          const v = (row[k] ?? '').toString().trim()
          if (v) return v
        }
        return ''
      }
      const omitir = (motivo: string) => {
        skipped++
        omitidas.push({
          fila: filaExcel,
          nombre:   str(['Nombre', 'nombre']),
          apellido: str(['Apellido', 'apellido']),
          empresa:  str(['Empresa', 'empresa']),
          mail:     str(['Mail', 'mail', 'Email']),
          motivo,
        })
      }

      try {
        const firstName = str(['Nombre', 'nombre'])
        const lastName  = str(['Apellido', 'apellido'])
        if (!firstName || !lastName) {
          const faltan = [!firstName && 'Nombre', !lastName && 'Apellido'].filter(Boolean).join(' y ')
          omitir(`Falta ${faltan}`)
          continue
        }

        const companyRaw = str(['Empresa', 'empresa'])   || null
        const role       = str(['Cargo', 'cargo'])        || null
        const email      = str(['Mail', 'mail', 'Email']).toLowerCase() || null
        const phone      = str(['Teléfono', 'Telefono', 'telefono'])    || null

        const empresaId = findEmpresaMatch(email, companyRaw, empresas)

        const key = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${empresaId || ''}`
        const existingId = existingByKey.get(key)
        if (existingId) { dupes++; if (base) idsParaBase.push(existingId); continue }
        if (pendingKeys.has(key)) { dupes++; continue }

        toCreate.push({ organizationId: orgId, firstName, lastName, companyRaw, role, email, phone, empresaId })
        pendingKeys.add(key)
        created++
      } catch (rowErr) {
        const msg = rowErr instanceof Error ? rowErr.message : 'error desconocido'
        omitir(`Error al procesar la fila: ${msg}`)
      }
    }

    if (toCreate.length > 0) {
      if (base) {
        const creados = await db.directorioContacto.createManyAndReturn({ data: toCreate, select: { id: true } })
        idsParaBase.push(...creados.map((c: { id: string }) => c.id))
      } else {
        await db.directorioContacto.createMany({ data: toCreate })
      }
    }

    const agregadosABase = base ? await addContactosToBase(base.id, idsParaBase) : 0

    return NextResponse.json({ created, dupes, skipped, omitidas, agregadosABase })
  } catch (error) {
    console.error('[CONTACTOS IMPORTAR]', error)
    return NextResponse.json({ error: 'Error al procesar el lote' }, { status: 500 })
  }
}
