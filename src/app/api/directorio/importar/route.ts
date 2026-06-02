import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

// Vercel max duration (requires Pro plan for > 10s — set in vercel.json if needed)
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const payload = await getCurrentUser()
  if (!payload) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return new Response(JSON.stringify({ error: 'No se recibió archivo' }), { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: 'El archivo está vacío' }), { status: 400 })
  }

  const db      = prisma as any
  const orgId   = payload.orgId
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      let empresasCreadas    = 0
      let empresasExistentes = 0
      let contactosCreados   = 0
      let filasOmitidas      = 0
      const total = rows.length

      try {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          const str = (key: string) => (row[key] ?? '').toString().trim()

          const empresaName = str('Empresa')
          const firstName   = str('Nombre')
          const lastName    = str('Apellido')

          if (!empresaName || !firstName) {
            filasOmitidas++
          } else {
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
            const email = str('Mail').toLowerCase() || null
            const dupWhere = email
              ? { organizationId: orgId, email }
              : { organizationId: orgId, firstName, lastName: lastName || '', empresaId: empresa.id }

            const existing = await db.directorioContacto.findFirst({
              where: dupWhere, select: { id: true },
            })

            if (existing) {
              filasOmitidas++
            } else {
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
          }

          // Enviar progreso cada 25 filas o en la última
          if ((i + 1) % 25 === 0 || i === rows.length - 1) {
            send({
              type: 'progress',
              processed: i + 1,
              total,
              empresasCreadas,
              empresasExistentes,
              contactosCreados,
              filasOmitidas,
            })
          }
        }

        send({
          type: 'done',
          processed: total,
          total,
          empresasCreadas,
          empresasExistentes,
          contactosCreados,
          filasOmitidas,
        })
      } catch (error) {
        console.error('[DIRECTORIO IMPORTAR]', error)
        send({ type: 'error', message: 'Error al procesar el archivo' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
