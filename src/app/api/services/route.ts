import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { unstable_cache } from 'next/cache'

// Row returned by the raw query
interface ServiceRow {
  id: string
  name: string
  description: string | null
  price: number
  currency: string
  billingCycle: string
  organizationId: string
  createdAt: Date
  updatedAt: Date
  client_count: bigint | number
}

// Replace N correlated subqueries with ONE LEFT JOIN + GROUP BY
async function fetchServicesWithCount(orgId: string) {
  const rows = await prisma.$queryRaw<ServiceRow[]>`
    SELECT
      s."id", s."name", s."description", s."price"::float, s."currency",
      s."billingCycle", s."organizationId",
      s."createdAt", s."updatedAt",
      COUNT(c."id")::int AS client_count
    FROM "Service" s
    LEFT JOIN "Client" c ON c."serviceId" = s."id"
    WHERE s."organizationId" = ${orgId}
    GROUP BY s."id"
    ORDER BY s."createdAt" DESC
  `
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    price: Number(r.price),
    currency: r.currency,
    billingCycle: r.billingCycle,
    organizationId: r.organizationId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    _count: { clients: Number(r.client_count) },
  }))
}

const getCachedServices = unstable_cache(
  fetchServicesWithCount,
  ['services-with-count'],
  { revalidate: 120 } // 2 min — services change infrequently
)

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const services = await getCachedServices(payload.orgId)

    return NextResponse.json(
      { data: services },
      { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=600' } }
    )
  } catch (error) {
    console.error('[SERVICES GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { name, description, price, currency, billingCycle } = await req.json()
    if (!name || price === undefined) {
      return NextResponse.json({ error: 'Nombre y precio son requeridos' }, { status: 400 })
    }

    const service = await prisma.service.create({
      data: {
        name,
        description: description || null,
        price: Number(price),
        currency: currency || 'USD',
        billingCycle: billingCycle || 'MONTHLY',
        organizationId: payload.orgId,
      },
    })

    return NextResponse.json({
      data: { ...service, _count: { clients: 0 } },
    }, { status: 201 })
  } catch (error) {
    console.error('[SERVICES POST]', error)
    return NextResponse.json({ error: 'Error al crear servicio' }, { status: 500 })
  }
}
