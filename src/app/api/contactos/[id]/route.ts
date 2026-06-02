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
    const contacto = await (prisma as any).directorioContacto.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      include: { empresa: { select: { id: true, name: true } } },
    })

    if (!contacto) return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })

    return NextResponse.json({
      data: { ...contacto, createdAt: contacto.createdAt.toISOString(), updatedAt: contacto.updatedAt.toISOString() }
    })
  } catch (error) {
    console.error('[CONTACTO GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exists = await (prisma as any).directorioContacto.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true },
    })
    if (!exists) return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })

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
    const contacto = await (prisma as any).directorioContacto.update({
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
      data: { ...contacto, createdAt: contacto.createdAt.toISOString(), updatedAt: contacto.updatedAt.toISOString() }
    })
  } catch (error) {
    console.error('[CONTACTO PUT]', error)
    return NextResponse.json({ error: 'Error al actualizar contacto' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exists = await (prisma as any).directorioContacto.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true },
    })
    if (!exists) return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).directorioContacto.delete({ where: { id: params.id } })

    return NextResponse.json({ message: 'Contacto eliminado' })
  } catch (error) {
    console.error('[CONTACTO DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar contacto' }, { status: 500 })
  }
}
