import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { unstable_cache } from 'next/cache'

async function fetchServiceTypes(orgId: string): Promise<string[]> {
  const rows = await prisma.client.findMany({
    where: { organizationId: orgId, serviceType: { not: null } },
    select: { serviceType: true },
    distinct: ['serviceType'],
    orderBy: { serviceType: 'asc' },
  })
  return rows.map((r) => r.serviceType!).filter(Boolean)
}

const getCachedServiceTypes = unstable_cache(fetchServiceTypes, ['service-types'], { revalidate: 300 })

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const types = await getCachedServiceTypes(payload.orgId)
    return NextResponse.json({ data: types })
  } catch (error) {
    console.error('[SERVICE-TYPES]', error)
    return NextResponse.json({ data: [] })
  }
}
