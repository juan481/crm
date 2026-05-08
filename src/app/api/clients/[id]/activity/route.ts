import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const client = await prisma.client.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
    })
    if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    const logs = await prisma.activityLog.findMany({
      where: { clientId: params.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { name: true, avatarUrl: true } } },
    })

    return NextResponse.json({ data: logs })
  } catch (error) {
    console.error('[ACTIVITY GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { description, action = 'NOTE' } = await req.json()
    if (!description?.trim()) return NextResponse.json({ error: 'La descripción es requerida' }, { status: 400 })

    const client = await prisma.client.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
    })
    if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    const log = await prisma.activityLog.create({
      data: {
        clientId: params.id,
        userId: payload.userId,
        action,
        description: description.trim(),
      },
      include: { user: { select: { name: true, avatarUrl: true } } },
    })

    return NextResponse.json({ data: log }, { status: 201 })
  } catch (error) {
    console.error('[ACTIVITY POST]', error)
    return NextResponse.json({ error: 'Error al crear entrada' }, { status: 500 })
  }
}
