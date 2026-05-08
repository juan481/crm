import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos para eliminar clientes' }, { status: 403 })
    }

    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Se requiere un array de IDs' }, { status: 400 })
    }

    const { count } = await prisma.client.deleteMany({
      where: { id: { in: ids }, organizationId: payload.orgId },
    })

    return NextResponse.json({ message: `${count} cliente${count !== 1 ? 's' : ''} eliminado${count !== 1 ? 's' : ''}`, count })
  } catch (error) {
    console.error('[BULK DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar clientes' }, { status: 500 })
  }
}
