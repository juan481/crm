import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { findEmpresaMatch } from '@/lib/directorio-link'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tecnico = await (prisma.tecnico as any).findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      include: { empresa: { select: { id: true, name: true } } },
    })

    if (!tecnico) return NextResponse.json({ error: 'Técnico no encontrado' }, { status: 404 })

    return NextResponse.json({
      data: { ...tecnico, createdAt: tecnico.createdAt.toISOString(), updatedAt: tecnico.updatedAt.toISOString() }
    })
  } catch (error) {
    console.error('[TECNICO GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exists = await (prisma.tecnico as any).findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true },
    })
    if (!exists) return NextResponse.json({ error: 'Técnico no encontrado' }, { status: 404 })

    const body = await req.json()
    const { firstName, lastName, companyRaw, role, email, phone, empresaId } = body

    if (!firstName?.trim() || !lastName?.trim())
      return NextResponse.json({ error: 'Nombre y apellido son requeridos' }, { status: 400 })

    let resolvedEmpresaId: string | null = empresaId ?? null

    if (!resolvedEmpresaId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const empresas = await (prisma.empresa as any).findMany({
        where: { organizationId: payload.orgId },
        select: { id: true, name: true, website: true },
      })
      resolvedEmpresaId = findEmpresaMatch(email, companyRaw, empresas)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tecnico = await (prisma.tecnico as any).update({
      where: { id: params.id },
      data: {
        firstName:  firstName.trim(),
        lastName:   lastName.trim(),
        companyRaw: companyRaw?.trim() || null,
        role:       role?.trim()       || null,
        email:      email?.trim().toLowerCase() || null,
        phone:      phone?.trim()      || null,
        empresaId:  resolvedEmpresaId,
      },
      include: { empresa: { select: { id: true, name: true } } },
    })

    return NextResponse.json({
      data: { ...tecnico, createdAt: tecnico.createdAt.toISOString(), updatedAt: tecnico.updatedAt.toISOString() }
    })
  } catch (error) {
    console.error('[TECNICO PUT]', error)
    return NextResponse.json({ error: 'Error al actualizar técnico' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exists = await (prisma.tecnico as any).findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true },
    })
    if (!exists) return NextResponse.json({ error: 'Técnico no encontrado' }, { status: 404 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.tecnico as any).delete({ where: { id: params.id } })

    return NextResponse.json({ message: 'Técnico eliminado' })
  } catch (error) {
    console.error('[TECNICO DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar técnico' }, { status: 500 })
  }
}
