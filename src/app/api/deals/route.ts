import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

const INCLUDE = {
  empresa: { select: { id: true, name: true, city: true } },
  client:  { select: { id: true, name: true, company: true } },
  owner:   { select: { id: true, name: true } },
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const stage   = searchParams.get('stage')
    const ownerId = searchParams.get('ownerId')
    const page    = Math.max(1, Number(searchParams.get('page')  ?? 1))
    const limit   = Math.min(100, Number(searchParams.get('limit') ?? 50))
    const skip    = (page - 1) * limit

    const where: Record<string, unknown> = { organizationId: payload.orgId }
    if (stage)   where.stage   = stage
    if (ownerId) where.ownerId = ownerId
    if (payload.role === 'SELLER') where.ownerId = payload.userId

    const db = prisma as any
    const [deals, total] = await Promise.all([
      db.deal.findMany({ where, skip, take: limit, orderBy: { updatedAt: 'desc' }, include: INCLUDE }),
      db.deal.count({ where }),
    ])

    return NextResponse.json({ data: deals, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[DEALS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { title, amount, currency, probability, stage, expectedCloseDate, notes, empresaId, clientId, ownerId } = await req.json()
    if (!title?.trim()) return NextResponse.json({ error: 'El título es requerido' }, { status: 400 })

    const db2 = prisma as any
    const deal = await db2.deal.create({
      data: {
        title:             title.trim(),
        amount:            Number(amount)      || 0,
        currency:          currency            || 'USD',
        probability:       Number(probability) || 0,
        stage:             stage               || 'LEAD',
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        notes:             notes               || null,
        empresaId:         empresaId           || null,
        clientId:          clientId            || null,
        ownerId:           ownerId             || payload.userId,
        organizationId:    payload.orgId,
      },
      include: INCLUDE,
    })

    return NextResponse.json({ data: deal }, { status: 201 })

  } catch (error) {
    console.error('[DEALS POST]', error)
    return NextResponse.json({ error: 'Error al crear deal' }, { status: 500 })
  }
}
