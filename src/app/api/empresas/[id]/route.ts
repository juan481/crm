import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const empresa = await (prisma as any).empresa.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      include: {
        contactos: {
          orderBy: { lastName: 'asc' },
          select: {
            id: true, firstName: true, lastName: true, companyRaw: true,
            role: true, email: true, phone: true, empresaId: true,
            createdAt: true, updatedAt: true,
          },
        },
      },
    })

    if (!empresa) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

    return NextResponse.json({
      data: {
        ...empresa,
        createdAt: empresa.createdAt.toISOString(),
        updatedAt: empresa.updatedAt.toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        contactos: empresa.contactos.map((c: any) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
      },
    })
  } catch (error) {
    console.error('[EMPRESA GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { name, activity, address, city, province, website } = body

    if (!name?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exists = await (prisma as any).empresa.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true },
    })
    if (!exists) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const empresa = await (prisma as any).empresa.update({
      where: { id: params.id },
      data: {
        name:     name.trim(),
        activity: activity?.trim() || null,
        address:  address?.trim()  || null,
        city:     city?.trim()     || null,
        province: province?.trim() || null,
        website:  website?.trim()  || null,
      },
    })

    return NextResponse.json({
      data: { ...empresa, createdAt: empresa.createdAt.toISOString(), updatedAt: empresa.updatedAt.toISOString() }
    })
  } catch (error) {
    console.error('[EMPRESA PUT]', error)
    return NextResponse.json({ error: 'Error al actualizar empresa' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exists = await (prisma as any).empresa.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true },
    })
    if (!exists) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).empresa.delete({ where: { id: params.id } })

    return NextResponse.json({ message: 'Empresa eliminada' })
  } catch (error) {
    console.error('[EMPRESA DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar empresa' }, { status: 500 })
  }
}
