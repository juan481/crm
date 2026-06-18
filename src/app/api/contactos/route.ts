import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { findEmpresaMatch } from '@/lib/directorio-link'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const search    = searchParams.get('search')    ?? ''
    const empresaId = searchParams.get('empresaId') ?? ''
    const page      = Math.max(1, Number(searchParams.get('page')  ?? 1))
    const limit     = Math.min(2000, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const skip      = (page - 1) * limit

    const where: Record<string, unknown> = { organizationId: payload.orgId }
    if (empresaId) where.empresaId = empresaId
    if (search.length >= 2) {
      where.OR = [
        { firstName:  { contains: search, mode: 'insensitive' } },
        { lastName:   { contains: search, mode: 'insensitive' } },
        { email:      { contains: search, mode: 'insensitive' } },
        { role:       { contains: search, mode: 'insensitive' } },
        { companyRaw: { contains: search, mode: 'insensitive' } },
        { empresa:    { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [raw, total] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any).directorioContacto.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: {
          id: true, firstName: true, lastName: true, companyRaw: true,
          role: true, email: true, phone: true, empresaId: true,
          createdAt: true, updatedAt: true,
          empresa: { select: { id: true, name: true } },
        },
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any).directorioContacto.count({ where }),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = raw.map((c: any) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }))

    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[CONTACTOS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { firstName, lastName, companyRaw, role, email, phone, empresaId } = body

    if (!firstName?.trim() || !lastName?.trim())
      return NextResponse.json({ error: 'Nombre y apellido son requeridos' }, { status: 400 })

    let resolvedEmpresaId: string | null = empresaId ?? null

    if (!resolvedEmpresaId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const empresas = await (prisma as any).empresa.findMany({
        where: { organizationId: payload.orgId },
        select: { id: true, name: true, website: true },
      })
      resolvedEmpresaId = findEmpresaMatch(email, companyRaw, empresas)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contacto = await (prisma as any).directorioContacto.create({
      data: {
        firstName:  firstName.trim(),
        lastName:   lastName.trim(),
        companyRaw: companyRaw?.trim() || null,
        role:       role?.trim()       || null,
        email:      email?.trim().toLowerCase() || null,
        phone:      phone?.trim()      || null,
        empresaId:  resolvedEmpresaId,
        organizationId: payload.orgId,
      },
      include: { empresa: { select: { id: true, name: true } } },
    })

    return NextResponse.json({
      data: { ...contacto, createdAt: contacto.createdAt.toISOString(), updatedAt: contacto.updatedAt.toISOString() }
    }, { status: 201 })
  } catch (error) {
    console.error('[CONTACTOS POST]', error)
    return NextResponse.json({ error: 'Error al crear contacto' }, { status: 500 })
  }
}
