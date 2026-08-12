import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface ImportRow {
  [key: string]: unknown
}

// Saca tildes ("Teléfono" -> "telefono") y pasa a minúscula, para que el
// matching de columnas no dependa de que el Excel use exactamente el mismo
// wording/acentuación que se probó acá. Encontrado en un caso real: un
// archivo con la columna "Teléfono" (con tilde) hacía que el teléfono se
// perdiera en silencio porque el código buscaba literal "Telefono" (sin
// tilde) — mismo problema podía pasar con cualquier otro campo. Mismo
// criterio que ya usaba /api/empresas/importar, extendido acá.
function normalizeKey(k: string): string {
  return k
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function normalizeRow(row: ImportRow): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(row)) out[normalizeKey(k)] = (v ?? '').toString().trim()
  return out
}

// Primer valor no vacío entre varios nombres de columna posibles (ya
// normalizados: sin tildes, en minúscula).
function col(r: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k]
    if (v?.trim()) return v.trim()
  }
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    // Faltaba este chequeo — la ruta hermana (empresas/importar) sí lo
    // tiene, y el botón que llega acá en la UI ya está oculto para
    // cualquiera que no sea SUPER_ADMIN/ADMIN, pero la API en sí quedaba
    // abierta a cualquier usuario autenticado (hasta un TECHNICIAN podía
    // importar en lote llamándola directo, sin pasar por la UI).
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json() as { rows: ImportRow[] }
    const rows = body.rows ?? []

    if (rows.length === 0) return NextResponse.json({ error: 'No se recibieron filas' }, { status: 400 })

    const db    = prisma as any
    const orgId = payload.orgId

    let empresasCreadas    = 0
    let empresasExistentes = 0
    let contactosCreados   = 0
    let filasOmitidas      = 0

    for (const rawRow of rows) {
      try {
        const row = normalizeRow(rawRow)

        const empresaName = col(row, 'empresa', 'company', 'razon social', 'nombre empresa')
        const firstName   = col(row, 'nombre', 'first name', 'firstname')

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
              activity:     col(row, 'actividad', 'rubro', 'sector')                        || null,
              address:      col(row, 'domicilio laboral', 'domicilio', 'direccion', 'address') || null,
              codigoPostal: col(row, 'codigo postal', 'cp')                                  || null,
              city:         col(row, 'localidad', 'ciudad', 'city')                          || null,
              province:     col(row, 'provincia', 'province')                                || null,
              country:      col(row, 'pais', 'country')                                      || null,
              website:      col(row, 'web', 'website', 'sitio web', 'url')                   || null,
            },
            select: { id: true },
          })
          empresasCreadas++
        } else {
          empresasExistentes++
        }

        // Dedup contacto — SIEMPRE por nombre+empresa, nunca sólo por mail.
        // Bug real encontrado: varias personas de una misma repartición
        // suelen compartir un mail genérico ("secgobierno@...",
        // "obraspublicas@..."); dedupear sólo por mail hacía que la 2ª y
        // 3ª persona con el mismo mail se descartaran como "ya existe" —
        // en un caso real (Municipalidad de Realicó) esto borró 2 de 3
        // personas en silencio, sin ningún aviso.
        const email    = col(row, 'mail', 'email', 'correo').toLowerCase() || null
        const lastName = col(row, 'apellido', 'last name', 'lastname') || null
        const dupWhere = { organizationId: orgId, firstName, lastName: lastName ?? '', empresaId: empresa.id }

        const existing = await db.directorioContacto.findFirst({ where: dupWhere, select: { id: true } })

        if (existing) { filasOmitidas++; continue }

        await db.directorioContacto.create({
          data: {
            organizationId: orgId,
            firstName,
            lastName,
            companyRaw:  empresaName,
            role:        col(row, 'cargo', 'rol', 'puesto', 'role') || null,
            email,
            phone:       col(row, 'telefono', 'tel', 'celular', 'whatsapp', 'phone') || null,
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
