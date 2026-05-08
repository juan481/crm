import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    await prisma.emailTemplate.deleteMany({
      where: { id: params.id, organizationId: payload.orgId },
    })

    return NextResponse.json({ message: 'Plantilla eliminada' })
  } catch (error) {
    console.error('[TEMPLATE DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
