import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Params { params: { id: string } }

const TIPOS_VALIDOS = ['NOTA', 'LLAMADA', 'REUNION', 'CHAT', 'ENVIO_COTIZACION', 'CONVERSACION', 'SOPORTE'] as const

// Mismo patrón que /api/empresas/[id]/notas y /api/deals/[id]/notas.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    // Mismo chequeo que ya tiene el POST de acá abajo — sin esto, cualquier
    // rol autenticado (sin acceso al Directorio en el sidebar) podía leer
    // notas de auditoría privadas con sólo conocer el id del contacto.
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any

    const contacto = await db.directorioContacto.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true },
    })
    if (!contacto) return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })

    const notas = await db.directorioContactoNota.findMany({
      where: { contactoId: params.id, organizationId: payload.orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, tipo: true, content: true, estimatedMinutes: true, metadata: true, createdAt: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    const data = notas.map((n: any) => ({ ...n, createdAt: n.createdAt.toISOString() }))
    return NextResponse.json({ data })
  } catch (error) {
    console.error('[CONTACTO NOTAS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    // Faltaba — /api/contactos (GET/POST) exige SELLER+ para tocar este
    // módulo, pero crear una nota se había salteado el mismo piso.
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any

    const contacto = await db.directorioContacto.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true },
    })
    if (!contacto) return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })

    const { content, tipo = 'NOTA', estimatedMinutes = 0, metadata } = await req.json()
    if (!content?.trim()) return NextResponse.json({ error: 'El contenido es requerido' }, { status: 400 })
    if (!TIPOS_VALIDOS.includes(tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

    const nota = await db.directorioContactoNota.create({
      data: {
        contactoId: params.id,
        organizationId: payload.orgId,
        userId: payload.userId,
        tipo,
        content: content.trim(),
        estimatedMinutes: Number(estimatedMinutes) || 0,
        metadata: metadata ?? null,
      },
      select: {
        id: true, tipo: true, content: true, estimatedMinutes: true, metadata: true, createdAt: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    return NextResponse.json({ data: { ...nota, createdAt: nota.createdAt.toISOString() } }, { status: 201 })
  } catch (error) {
    console.error('[CONTACTO NOTAS POST]', error)
    return NextResponse.json({ error: 'Error al guardar nota' }, { status: 500 })
  }
}
