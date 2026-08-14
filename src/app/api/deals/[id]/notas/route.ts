import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Params { params: { id: string } }

const TIPOS_VALIDOS = ['NOTA', 'LLAMADA', 'REUNION', 'CHAT', 'ENVIO_COTIZACION', 'CONVERSACION', 'SOPORTE'] as const

// Mismo shape que /api/empresas/[id]/notas — ver ese archivo para el patrón
// original (Fase 8 del plan lo replica para Deal en vez de generalizarlo,
// a propósito, para no arriesgar una regresión en la feature de Empresa).
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    // Faltaba acá también (ver mismo fix en POST más abajo) — /api/deals
    // exige SELLER+ en todos sus verbos; sin este chequeo, cualquier
    // usuario autenticado de la org (HR, TECHNICIAN) podía leer notas
    // privadas de negociación de un deal con sólo conocer su id, aunque no
    // pudiera ver el deal en sí vía /api/deals/[id].
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any

    // ownerId para SELLER — sin esto, un SELLER que no puede ver el deal de
    // otro vendedor vía GET /api/deals/[id] (404) igual podía leer/agregar
    // notas de negociación en ese deal ajeno, si conocía el id. Mismo
    // criterio que ya usa GET /api/deals/[id].
    const deal = await db.deal.findFirst({
      where: {
        id: params.id, organizationId: payload.orgId,
        ...(payload.role === 'SELLER' && { ownerId: payload.userId }),
      },
      select: { id: true },
    })
    if (!deal) return NextResponse.json({ error: 'Oportunidad no encontrada' }, { status: 404 })

    const notas = await db.dealNota.findMany({
      where: { dealId: params.id, organizationId: payload.orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, tipo: true, content: true, estimatedMinutes: true, metadata: true, createdAt: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    const data = notas.map((n: any) => ({ ...n, createdAt: n.createdAt.toISOString() }))
    return NextResponse.json({ data })
  } catch (error) {
    console.error('[DEAL NOTAS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    // Faltaba — /api/deals exige SELLER+, esta ruta se había salteado ese piso.
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any

    // ownerId para SELLER — sin esto, un SELLER que no puede ver el deal de
    // otro vendedor vía GET /api/deals/[id] (404) igual podía leer/agregar
    // notas de negociación en ese deal ajeno, si conocía el id. Mismo
    // criterio que ya usa GET /api/deals/[id].
    const deal = await db.deal.findFirst({
      where: {
        id: params.id, organizationId: payload.orgId,
        ...(payload.role === 'SELLER' && { ownerId: payload.userId }),
      },
      select: { id: true },
    })
    if (!deal) return NextResponse.json({ error: 'Oportunidad no encontrada' }, { status: 404 })

    const { content, tipo = 'NOTA', estimatedMinutes = 0, metadata } = await req.json()
    if (!content?.trim()) return NextResponse.json({ error: 'El contenido es requerido' }, { status: 400 })
    if (!TIPOS_VALIDOS.includes(tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

    const nota = await db.dealNota.create({
      data: {
        dealId: params.id,
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
    console.error('[DEAL NOTAS POST]', error)
    return NextResponse.json({ error: 'Error al guardar nota' }, { status: 500 })
  }
}
