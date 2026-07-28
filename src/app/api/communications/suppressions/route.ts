import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER'))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { searchParams } = req.nextUrl
    const search = searchParams.get('search') ?? ''
    const page   = Math.max(1, Number(searchParams.get('page'))  || 1)
    const limit  = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20))
    const skip   = (page - 1) * limit

    const db = prisma as any
    const where: Record<string, unknown> = { organizationId: payload.orgId }
    if (search.length >= 2) where.email = { contains: search, mode: 'insensitive' }

    const [data, total] = await Promise.all([
      db.emailSuppression.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      db.emailSuppression.count({ where }),
    ])

    return NextResponse.json({ data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) })
  } catch (error) {
    console.error('[SUPPRESSIONS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
