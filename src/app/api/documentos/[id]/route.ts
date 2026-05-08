import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { unlink } from 'fs/promises'
import { join } from 'path'

interface Params { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { name, tags } = await req.json()

    const document = await prisma.document.updateMany({
      where: { id: params.id, organizationId: payload.orgId },
      data: {
        ...(name && { name }),
        ...(tags !== undefined && { tags: JSON.stringify(tags) }),
      },
    })

    return NextResponse.json({ data: document })
  } catch (error) {
    console.error('[DOC PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const doc = await prisma.document.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
    })

    if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

    try {
      const filePath = join(process.cwd(), 'public', doc.url)
      await unlink(filePath)
    } catch {
      // file may not exist on disk
    }

    await prisma.document.delete({ where: { id: params.id } })

    return NextResponse.json({ message: 'Documento eliminado' })
  } catch (error) {
    console.error('[DOC DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
