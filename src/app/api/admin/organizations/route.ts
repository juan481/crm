import { NextResponse } from 'next/server'
import { getPlatformAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const admin = await getPlatformAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = prisma as any
    const orgs = await db.organization.findMany({
      select: {
        id: true, name: true, domain: true, crmName: true,
        suspended: true, suspendedAt: true, createdAt: true,
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ data: orgs })
  } catch (error) {
    console.error('[ADMIN ORGANIZATIONS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
