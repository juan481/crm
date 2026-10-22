import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Legajo de vigiladores (ABBA FISICA, reestructuración 2026-10) — el
// vigilador no es un usuario del CRM (ver comentario en el modelo
// Vigilador, schema.prisma), así que esto es un módulo propio, no un caso
// más de /api/usuarios. El único piso es roleHasModule('legajos') — sin
// floor de canAccess() tipo 'SELLER' a propósito: es dato sensible de
// personal, nadie lo ve salvo que el default (ADMIN+/ADMINISTRATIVO/HR) o
// un toggle explícito de Permisos lo habilite.
export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await roleHasModule(payload.orgId, payload.role, 'legajos')))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { searchParams } = req.nextUrl
    const search = searchParams.get('search') ?? ''
    const page   = Math.max(1, Number(searchParams.get('page')  ?? 1))
    const limit  = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const skip   = (page - 1) * limit

    const db = prisma as any
    const where: Record<string, unknown> = { organizationId: payload.orgId }
    if (search.length >= 2) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { apellido: { contains: search, mode: 'insensitive' } },
        { dni: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [raw, total] = await Promise.all([
      db.vigilador.findMany({
        where, skip, take: limit,
        orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
        // art/notas no se muestran en esta tabla, pero viajan igual: el
        // modal de edición que abre esta misma pantalla reusa LegajoForm,
        // y sin estos dos campos un guardado desde el listado pisaba esos
        // valores con null (bug real, encontrado al tipar el form).
        select: {
          id: true, nombre: true, apellido: true, dni: true, fechaIngreso: true,
          carnetVencimiento: true, art: true, lugarTrabajo: true, notas: true, activo: true, createdAt: true,
        },
      }),
      db.vigilador.count({ where }),
    ])

    const data = raw.map((v: any) => ({
      ...v,
      fechaIngreso: v.fechaIngreso ? v.fechaIngreso.toISOString() : null,
      carnetVencimiento: v.carnetVencimiento ? v.carnetVencimiento.toISOString() : null,
      createdAt: v.createdAt.toISOString(),
    }))

    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[LEGAJOS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await roleHasModule(payload.orgId, payload.role, 'legajos')))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { nombre, apellido, dni, fechaIngreso, carnetVencimiento, art, lugarTrabajo, notas } = await req.json()
    if (!nombre?.trim() || !apellido?.trim() || !dni?.trim())
      return NextResponse.json({ error: 'Nombre, apellido y DNI son requeridos' }, { status: 400 })

    const db = prisma as any
    try {
      const vigilador = await db.vigilador.create({
        data: {
          organizationId: payload.orgId,
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          dni: dni.trim(),
          // Campos @db.Date — Postgres no guarda hora, Prisma reconstruye
          // siempre medianoche UTC al leer sin importar qué hora se haya
          // mandado acá; no hace falta (ni ayuda) el truco de "mediodía UTC"
          // que sí hace falta en DateTime completos como Invoice.dueDate.
          // El bug real de desplazamiento de día está en cómo se MUESTRA
          // esto en el frontend (toLocaleDateString con timezone local),
          // no en cómo se guarda — ver fmtDateUTC en las páginas de legajos.
          fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : null,
          carnetVencimiento: carnetVencimiento ? new Date(carnetVencimiento) : null,
          art: art?.trim() || null,
          lugarTrabajo: lugarTrabajo?.trim() || null,
          notas: notas?.trim() || null,
        },
      })
      return NextResponse.json({ data: vigilador }, { status: 201 })
    } catch (err: any) {
      if (err?.code === 'P2002' && err?.meta?.target?.includes?.('dni')) {
        return NextResponse.json({ error: 'Ya existe un legajo con ese DNI' }, { status: 409 })
      }
      throw err
    }
  } catch (error) {
    console.error('[LEGAJOS POST]', error)
    return NextResponse.json({ error: 'Error al crear el legajo' }, { status: 500 })
  }
}
