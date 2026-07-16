import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN'))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    const { name, subject, body } = await req.json()
    const template = await prisma.emailTemplate.updateMany({
      where: { id: params.id, organizationId: payload.orgId },
      data: {
        ...(name    && { name:    name.trim()    }),
        ...(subject && { subject: subject.trim() }),
        ...(body    && { body }),
      },
    })
    if (template.count === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ message: 'Plantilla actualizada' })
  } catch (error) {
    console.error('[TEMPLATE PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN'))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    await prisma.emailTemplate.deleteMany({
      where: { id: params.id, organizationId: payload.orgId },
    })

    return NextResponse.json({ message: 'Plantilla eliminada' })
  } catch (error) {
    console.error('[TEMPLATE DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
