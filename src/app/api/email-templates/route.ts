import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(_: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const templates = await prisma.emailTemplate.findMany({
      where: { organizationId: payload.orgId },
      orderBy: { updatedAt: 'desc' },
      include: { createdBy: { select: { name: true } } },
    })

    return NextResponse.json({ data: templates })
  } catch (error) {
    console.error('[TEMPLATES GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { name, subject, body } = await req.json()
    if (!name?.trim() || !subject?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Nombre, asunto y cuerpo son requeridos' }, { status: 400 })
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name: name.trim(),
        subject: subject.trim(),
        body,
        organizationId: payload.orgId,
        createdById: payload.userId,
      },
      include: { createdBy: { select: { name: true } } },
    })

    return NextResponse.json({ data: template }, { status: 201 })
  } catch (error) {
    console.error('[TEMPLATES POST]', error)
    return NextResponse.json({ error: 'Error al crear plantilla' }, { status: 500 })
  }
}
