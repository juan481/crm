import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Params { params: { id: string } }

const TIPOS_VALIDOS = ['NOTA', 'LLAMADA', 'REUNION', 'CHAT', 'ENVIO_COTIZACION', 'CONVERSACION', 'SOPORTE'] as const

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = prisma as any

    const empresa = await db.empresa.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true },
    })
    if (!empresa) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

    const notas = await db.empresaNota.findMany({
      where: { empresaId: params.id, organizationId: payload.orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id:               true,
        tipo:             true,
        content:          true,
        estimatedMinutes: true,
        metadata:         true,
        createdAt:        true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    const data = notas.map((n: any) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[EMPRESA NOTAS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = prisma as any

    const empresa = await db.empresa.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true },
    })
    if (!empresa) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

    const { content, tipo = 'NOTA', estimatedMinutes = 0, metadata } = await req.json()
    if (!content?.trim()) return NextResponse.json({ error: 'El contenido es requerido' }, { status: 400 })
    if (!TIPOS_VALIDOS.includes(tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

    const nota = await db.empresaNota.create({
      data: {
        empresaId:        params.id,
        organizationId:   payload.orgId,
        userId:           payload.userId,
        tipo,
        content:          content.trim(),
        estimatedMinutes: Number(estimatedMinutes) || 0,
        metadata:         metadata ?? null,
      },
      select: {
        id:               true,
        tipo:             true,
        content:          true,
        estimatedMinutes: true,
        metadata:         true,
        createdAt:        true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    return NextResponse.json({
      data: { ...nota, createdAt: nota.createdAt.toISOString() }
    }, { status: 201 })
  } catch (error) {
    console.error('[EMPRESA NOTAS POST]', error)
    return NextResponse.json({ error: 'Error al guardar nota' }, { status: 500 })
  }
}
