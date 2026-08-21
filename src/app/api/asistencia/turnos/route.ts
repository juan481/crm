import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { argentinaDateKeyToDayStart, argentinaTimeToInstant } from '@/lib/timezone'
import { mirrorAsistencia, MODALIDADES_FICHAJE, ETIQUETAS_TURNO } from '@/lib/asistencia-turnos'

export const dynamic = 'force-dynamic'

// Mismo criterio de visibilidad que GET /api/asistencia: HR/ADMIN/SUPER_ADMIN
// ven el de cualquiera de la org, el resto sólo lo propio (ignora el
// ?userId= que manden si no es el suyo).
export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const mes      = searchParams.get('mes') // YYYY-MM
    const etiqueta = searchParams.get('etiqueta')
    const modalidad = searchParams.get('modalidad')
    const requestedUserId = searchParams.get('userId')

    const db = prisma as any
    const canSeeAll = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(payload.role)
    const userId = canSeeAll ? (requestedUserId || undefined) : payload.userId

    const where: Record<string, unknown> = { organizationId: payload.orgId }
    if (userId) where.userId = userId
    if (etiqueta && ETIQUETAS_TURNO.includes(etiqueta)) where.etiqueta = etiqueta
    if (modalidad && MODALIDADES_FICHAJE.includes(modalidad)) where.modalidad = modalidad
    if (mes) {
      const [y, m] = mes.split('-').map(Number)
      where.fecha = { gte: new Date(Date.UTC(y, m - 1, 1)), lte: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)) }
    }

    const turnos = await db.turnoAsistencia.findMany({
      where,
      include: { user: { select: { id: true, name: true, role: true, avatarUrl: true } } },
      orderBy: [{ fecha: 'desc' }, { horaEntrada: 'asc' }],
    })

    return NextResponse.json({ data: turnos })
  } catch (error) {
    console.error('[TURNOS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Sergio crea un bloque manual para cualquier usuario de la org — turno
// olvidado, o un extra ya conocido. Mismo patrón de permisos/scoping que
// POST /api/asistencia.
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const canManage = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(payload.role)
    if (!canManage) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json()
    const { userId, entradaFecha, entradaHora, salidaFecha, salidaHora, observaciones } = body
    const modalidad = MODALIDADES_FICHAJE.includes(body.modalidad) ? body.modalidad : MODALIDADES_FICHAJE[0]
    const etiquetaInput = ETIQUETAS_TURNO.includes(body.etiqueta) ? body.etiqueta : null

    if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
    if (!entradaFecha) return NextResponse.json({ error: 'Fecha de entrada requerida' }, { status: 400 })

    // Mismo chequeo que el resto de la app: el usuario destino tiene que
    // pertenecer a esta organización (evita inyección cross-org).
    const targetUser = await prisma.user.findFirst({ where: { id: userId, organizationId: payload.orgId } })
    if (!targetUser) return NextResponse.json({ error: 'Usuario no encontrado en esta organización' }, { status: 404 })

    const db = prisma as any
    const fecha = argentinaDateKeyToDayStart(entradaFecha)

    let horaEntrada: Date | null = null
    if (entradaHora) {
      const [h, m] = entradaHora.split(':').map(Number)
      horaEntrada = argentinaTimeToInstant(fecha, h, m)
    }

    let horaSalida: Date | null = null
    if (salidaHora) {
      // Fecha de salida independiente de la de entrada — acá es donde se
      // resuelve de verdad el cruce de medianoche para cargas manuales
      // (a diferencia de los modales viejos de RRHH, que fuerzan el mismo
      // día calendario para las dos horas).
      const fechaSalida = salidaFecha ? argentinaDateKeyToDayStart(salidaFecha) : fecha
      const [h, m] = salidaHora.split(':').map(Number)
      horaSalida = argentinaTimeToInstant(fechaSalida, h, m)
    }

    // esPrincipal se recalcula server-side, Sergio no lo elige a mano —
    // mismo criterio que el check-in real: el primer bloque del día es el
    // principal.
    const yaHayPrincipal = await db.turnoAsistencia.findFirst({
      where: { userId, organizationId: payload.orgId, fecha, esPrincipal: true },
      select: { id: true },
    })
    const esPrincipal = !yaHayPrincipal
    const etiqueta = etiquetaInput ?? (esPrincipal ? 'Regular' : 'Extra/Adicional')

    const turno = await db.turnoAsistencia.create({
      data: {
        userId, organizationId: payload.orgId, fecha,
        horaEntrada, horaSalida, modalidad, etiqueta, esPrincipal,
        observaciones: observaciones || null,
        creadoPorId: payload.userId,
      },
    })

    if (esPrincipal) {
      await mirrorAsistencia(db, { userId, organizationId: payload.orgId, fecha, horaEntrada, horaSalida })
    }

    return NextResponse.json({ data: turno }, { status: 201 })
  } catch (error) {
    console.error('[TURNOS POST]', error)
    return NextResponse.json({ error: 'Error al crear el bloque' }, { status: 500 })
  }
}
