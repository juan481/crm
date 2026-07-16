import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { name } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

    const folder = await prisma.folder.updateMany({
      where: { id: params.id, organizationId: payload.orgId },
      data: { name: name.trim() },
    })

    if (folder.count === 0) return NextResponse.json({ error: 'Carpeta no encontrada' }, { status: 404 })

    return NextResponse.json({ message: 'Carpeta renombrada' })
  } catch (error) {
    console.error('[FOLDER PATCH]', error)
    return NextResponse.json({ error: 'Error al renombrar carpeta' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const folder = await prisma.folder.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      include: {
        _count: { select: { documents: true, children: true } },
      },
    })

    if (!folder) return NextResponse.json({ error: 'Carpeta no encontrada' }, { status: 404 })

    if (folder._count.documents > 0 || folder._count.children > 0) {
      return NextResponse.json(
        { error: 'La carpeta no está vacía. Eliminá el contenido primero.' },
        { status: 409 },
      )
    }

    await prisma.folder.delete({ where: { id: params.id } })

    return NextResponse.json({ message: 'Carpeta eliminada' })
  } catch (error) {
    console.error('[FOLDER DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar carpeta' }, { status: 500 })
  }
}
