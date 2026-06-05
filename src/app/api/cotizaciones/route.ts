import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const search = searchParams.get('search') ?? ''
    const page   = Math.max(1, Number(searchParams.get('page')  ?? 1))
    const limit  = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const skip   = (page - 1) * limit

    const db = prisma as any

    const empresaIdFilter = searchParams.get('empresaId') ?? ''
    const where: Record<string, unknown> = { organizationId: payload.orgId }

    if (empresaIdFilter) where.empresaId = empresaIdFilter

    if (search.length >= 2) {
      where.OR = [
        { ref:           { contains: search, mode: 'insensitive' } },
        { recipientName: { contains: search, mode: 'insensitive' } },
        { empresa: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [raw, total] = await Promise.all([
      db.cotizacion.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id:            true,
          ref:           true,
          recipientName: true,
          recipientEmail:true,
          total:         true,
          currency:      true,
          status:        true,
          createdAt:     true,
          notes:         true,
          items:         true,
          empresa: { select: { id: true, name: true } },
          user:    { select: { id: true, name: true } },
        },
      }),
      db.cotizacion.count({ where }),
    ])

    const data = raw.map((c: any) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    }))

    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[COTIZACIONES GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
