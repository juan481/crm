import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { puedeVerCompras } from '@/lib/stock-access'
import { prisma } from '@/lib/db'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

const LIST_SELECT = {
  id: true, numero: true, estado: true, condicionPago: true, createdAt: true, enviadoAt: true,
  proveedor: { select: { id: true, name: true } },
  _count: { select: { items: true } },
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const { searchParams } = req.nextUrl
    const estado = searchParams.get('estado') ?? ''
    const page   = Math.max(1, Number(searchParams.get('page')  ?? 1))
    const limit  = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const skip   = (page - 1) * limit

    const where: Record<string, unknown> = { organizationId: payload.orgId }
    if (estado) where.estado = estado

    const [raw, total] = await Promise.all([
      db.solicitudCompra.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, select: LIST_SELECT }),
      db.solicitudCompra.count({ where }),
    ])

    const data = raw.map((s: any) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      enviadoAt: s.enviadoAt?.toISOString() ?? null,
    }))

    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[SOLICITUDES COMPRA GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Crea un BORRADOR vacío — el armado real (proveedor, items, condición de
// pago) pasa después en la ficha (PATCH /[id]), mismo patrón que "Nuevo
// Deal" en Pipeline: primero existe el registro, después se completa.
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const db = prisma as any

    let proveedorId: string | null = null
    if (body.proveedorId) {
      const proveedor = await db.empresa.findFirst({
        where: { id: body.proveedorId, organizationId: payload.orgId, esProveedor: true },
        select: { id: true },
      })
      if (!proveedor) return NextResponse.json({ error: 'Proveedor no encontrado en esta organización' }, { status: 400 })
      proveedorId = proveedor.id
    }

    const solicitud = await db.solicitudCompra.create({
      data: {
        organizationId: payload.orgId,
        creadoPorId: payload.userId,
        proveedorId,
      },
      select: { id: true },
    })

    return NextResponse.json({ data: solicitud }, { status: 201 })
  } catch (error) {
    console.error('[SOLICITUDES COMPRA POST]', error)
    return NextResponse.json({ error: 'Error al crear la solicitud' }, { status: 500 })
  }
}
