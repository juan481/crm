import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { content, type = 'NOTE' } = await req.json()
    if (!content?.trim()) {
      return NextResponse.json({ error: 'El contenido es requerido' }, { status: 400 })
    }

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
    })
    if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    const note = await prisma.note.create({
      data: {
        content: content.trim(),
        type,
        clientId: params.id,
        userId: payload.userId,
      },
      include: { user: { select: { name: true, avatarUrl: true } } },
    })

    return NextResponse.json({ data: note }, { status: 201 })
  } catch (error) {
    console.error('[NOTES POST]', error)
    return NextResponse.json({ error: 'Error al crear nota' }, { status: 500 })
  }
}
