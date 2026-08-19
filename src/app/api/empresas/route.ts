import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { relinkContactos } from '@/lib/directorio-link'

export const dynamic = 'force-dynamic'

const SELECT = {
  id: true, name: true, isCliente: true, clienteDesde: true,
  activity: true, address: true, codigoPostal: true,
  city: true, province: true, country: true, website: true,
  // Cartera de Ventas — reparto de trabajo, no aislamiento de datos (ver
  // comentario en el schema). Se incluye acá para que el formulario de
  // edición sepa mostrar el dueño actual; no se filtra por esto salvo que
  // venga ?scope=cartera (ver GET más abajo).
  ownerId: true,
  // Bug real encontrado en auditoría: faltaban acá aunque ya se escriben
  // en el POST de más abajo y se leen en GET /api/empresas/[id] (que usa
  // su propio SELECT) — la respuesta de "crear empresa" nunca traía de
  // vuelta el CUIT/condición de IVA/forma de pago recién cargados, aunque
  // sí habían quedado guardados en la DB.
  cuit: true, condicionIva: true, formaPagoHabitual: true,
  createdAt: true, updatedAt: true,
  _count: { select: { contactos: true } },
}

// GET is intentionally open to any authenticated role — Tickets and Mi Día
// (reachable by TECHNICIAN) need this list for their "empresa" picker.
// Only the write operations below are restricted to the Directorio's own
// floor (SELLER+), matching the sidebar.
export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const search          = searchParams.get('search')          ?? ''
    const isCliente       = searchParams.get('isCliente')
    const filterActividad = searchParams.get('filterActividad') ?? ''
    const filterCiudad    = searchParams.get('filterCiudad')    ?? ''
    const tieneWeb        = searchParams.get('tieneWeb')        // 'si' | 'no' | null
    const scope           = searchParams.get('scope')           // 'cartera' | null
    const page            = Math.max(1, Number(searchParams.get('page')  ?? 1))
    const limit           = Math.min(2000, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const skip            = (page - 1) * limit

    const db = prisma as any
    const where: Record<string, unknown> = { organizationId: payload.orgId }

    if (isCliente === 'true')  where.isCliente = true
    if (isCliente === 'false') where.isCliente = false

    // Dedicated field filters
    if (filterActividad.length >= 2) where.activity = { contains: filterActividad, mode: 'insensitive' }
    if (filterCiudad.length    >= 2) where.city     = { contains: filterCiudad,    mode: 'insensitive' }
    if (tieneWeb === 'si')  where.website = { not: null }
    if (tieneWeb === 'no')  where.website = null

    // Cartera de Ventas — sólo se aplica si el caller lo pide explícitamente
    // Y es SELLER. Sin el parámetro, comportamiento idéntico a siempre: este
    // mismo GET es compartido por 9 pantallas (picker de Tickets/Mi Día para
    // TECHNICIAN, Pipeline/Cotizador, merge de duplicados) que necesitan ver
    // el directorio completo aunque quien pregunte sea un SELLER — filtrar
    // acá de forma incondicional las rompería.
    if (scope === 'cartera' && payload.role === 'SELLER') where.ownerId = payload.userId

    // General search: name, activity, city + bidirectional (contact names)
    if (search.length >= 2) {
      where.OR = [
        { name:     { contains: search, mode: 'insensitive' } },
        { activity: { contains: search, mode: 'insensitive' } },
        { city:     { contains: search, mode: 'insensitive' } },
        { contactos: { some: { OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName:  { contains: search, mode: 'insensitive' } },
        ] } } },
      ]
    }

    const [raw, total] = await Promise.all([
      db.empresa.findMany({ where, skip, take: limit, orderBy: { name: 'asc' }, select: SELECT }),
      db.empresa.count({ where }),
    ])

    const data = raw.map((e: any) => ({
      ...e,
      clienteDesde: e.clienteDesde?.toISOString() ?? null,
      createdAt:    e.createdAt.toISOString(),
      updatedAt:    e.updatedAt.toISOString(),
    }))

    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[EMPRESAS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json()
    const { name, activity, address, codigoPostal, city, province, country, website, ownerId, cuit, condicionIva, formaPagoHabitual } = body

    if (!name?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

    const db = prisma as any

    // Asignar cartera es cosa de ADMIN+ — un SELLER no se auto-asigna
    // clientes (mismo criterio que reasignar el dueño de un Deal). Además,
    // re-validar que el id recibido sea un usuario DE ESTA organización —
    // sin esto, un ownerId de otra organización pasado a mano (nunca vía la
    // UI, que sólo ofrece vendedores de la propia org) quedaría guardado
    // igual y más tarde se mostraría su nombre en esta org (fuga cross-org).
    // Mismo criterio que ya se usa en el resto del código para cualquier FK
    // que llega en el body (empresaId/clientId/dealId/etc.).
    const canAssignOwner = canAccess(payload.role, 'ADMIN')
    let validOwnerId: string | null = null
    if (canAssignOwner && ownerId?.trim()) {
      const owner = await db.user.findFirst({ where: { id: ownerId.trim(), organizationId: payload.orgId }, select: { id: true } })
      validOwnerId = owner?.id ?? null
    }

    const empresa = await db.empresa.create({
      data: {
        name:         name.trim(),
        activity:     activity?.trim()     || null,
        address:      address?.trim()      || null,
        codigoPostal: codigoPostal?.trim() || null,
        city:         city?.trim()         || null,
        province:     province?.trim()     || null,
        country:      country?.trim()      || null,
        website:      website?.trim()      || null,
        cuit:               cuit?.trim()               || null,
        condicionIva:       condicionIva?.trim()        || null,
        formaPagoHabitual:  formaPagoHabitual?.trim()   || null,
        ownerId:      validOwnerId,
        organizationId: payload.orgId,
      },
      select: SELECT,
    })

    // Link any existing unlinked contacts that match this empresa
    await relinkContactos(db, empresa.id, empresa.name, payload.orgId, empresa.website)

    return NextResponse.json({
      data: {
        ...empresa,
        clienteDesde: empresa.clienteDesde?.toISOString() ?? null,
        createdAt:    empresa.createdAt.toISOString(),
        updatedAt:    empresa.updatedAt.toISOString(),
        _count: { contactos: 0 },
      }
    }, { status: 201 })
  } catch (error) {
    console.error('[EMPRESAS POST]', error)
    return NextResponse.json({ error: 'Error al crear empresa' }, { status: 500 })
  }
}
