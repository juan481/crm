import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { relinkContactos } from '@/lib/directorio-link'

export const dynamic = 'force-dynamic'

const SELECT = {
  id: true, name: true, isCliente: true, clienteDesde: true,
  activity: true, address: true, codigoPostal: true,
  city: true, province: true, country: true, website: true,
  createdAt: true, updatedAt: true,
  _count: { select: { contactos: true } },
}

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
    const page            = Math.max(1, Number(searchParams.get('page')  ?? 1))
    const limit           = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))
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

    const body = await req.json()
    const { name, activity, address, codigoPostal, city, province, country, website } = body

    if (!name?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

    const db = prisma as any

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
        organizationId: payload.orgId,
      },
      select: SELECT,
    })

    // Link any existing unlinked contacts that match this empresa
    await relinkContactos(db, empresa.id, empresa.name, payload.orgId)

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
