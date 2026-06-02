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

    const where: Record<string, unknown> = { organizationId: payload.orgId }
    if (search.length >= 2) {
      where.OR = [
        { name:     { contains: search, mode: 'insensitive' } },
        { activity: { contains: search, mode: 'insensitive' } },
        { city:     { contains: search, mode: 'insensitive' } },
      ]
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    const [raw, total] = await Promise.all([
      db.empresa.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true, name: true, activity: true, address: true,
          city: true, province: true, website: true,
          createdAt: true, updatedAt: true,
          _count: { select: { contactos: true } },
        },
      }),
      db.empresa.count({ where }),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = raw.map((e: any) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
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
    const { name, activity, address, city, province, website } = body

    if (!name?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const empresa = await (prisma as any).empresa.create({
      data: {
        name:     name.trim(),
        activity: activity?.trim() || null,
        address:  address?.trim()  || null,
        city:     city?.trim()     || null,
        province: province?.trim() || null,
        website:  website?.trim()  || null,
        organizationId: payload.orgId,
      },
    })

    return NextResponse.json({
      data: {
        ...empresa,
        createdAt: empresa.createdAt.toISOString(),
        updatedAt: empresa.updatedAt.toISOString(),
        _count: { contactos: 0 },
      }
    }, { status: 201 })
  } catch (error) {
    console.error('[EMPRESAS POST]', error)
    return NextResponse.json({ error: 'Error al crear empresa' }, { status: 500 })
  }
}
