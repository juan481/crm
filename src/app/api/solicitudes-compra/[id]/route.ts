import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { puedeVerCompras } from '@/lib/stock-access'
import { prisma } from '@/lib/db'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

const DETAIL_SELECT = {
  id: true, numero: true, estado: true, condicionPago: true, notas: true,
  contactoEmail: true, contactoNombre: true, createdAt: true, enviadoAt: true,
  proveedor: { select: { id: true, name: true } },
  items: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true, productId: true, sku: true, nombre: true, cantidad: true,
      costoUnitario: true, moneda: true, disponible: true, resueltoAt: true,
    },
  },
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const solicitud = await db.solicitudCompra.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: DETAIL_SELECT,
    })
    if (!solicitud) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    return NextResponse.json({
      data: {
        ...solicitud,
        createdAt: solicitud.createdAt.toISOString(),
        enviadoAt: solicitud.enviadoAt?.toISOString() ?? null,
        items: solicitud.items.map((it: any) => ({ ...it, resueltoAt: it.resueltoAt?.toISOString() ?? null })),
      },
    })
  } catch (error) {
    console.error('[SOLICITUD COMPRA GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Editar proveedor/condición de pago/notas — sólo mientras es BORRADOR. Una
// vez enviada, el pedido ya salió por mail; cambiar estos datos acá no
// tendría ningún efecto real del lado del importador.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const existing = await db.solicitudCompra.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true, estado: true },
    })
    if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    if (existing.estado !== 'BORRADOR') {
      return NextResponse.json({ error: 'Ya se envió — no se puede editar, sólo anular' }, { status: 409 })
    }

    const { proveedorId, condicionPago, notas } = await req.json()
    const data: Record<string, unknown> = {}

    if (proveedorId !== undefined) {
      if (proveedorId === null || proveedorId === '') {
        data.proveedorId = null
      } else {
        const proveedor = await db.empresa.findFirst({
          where: { id: proveedorId, organizationId: payload.orgId, esProveedor: true },
          select: { id: true },
        })
        if (!proveedor) return NextResponse.json({ error: 'Proveedor no encontrado en esta organización' }, { status: 400 })
        data.proveedorId = proveedor.id
      }
    }
    if (condicionPago !== undefined) data.condicionPago = condicionPago?.trim() || null
    if (notas !== undefined) data.notas = notas?.trim() || null

    await db.solicitudCompra.update({ where: { id: params.id }, data })
    return NextResponse.json({ message: 'Solicitud actualizada' })
  } catch (error) {
    console.error('[SOLICITUD COMPRA PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const existing = await db.solicitudCompra.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true, estado: true },
    })
    if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    if (existing.estado !== 'BORRADOR') {
      return NextResponse.json({ error: 'Ya se envió — usá "Anular" en vez de borrar' }, { status: 409 })
    }

    await db.solicitudCompra.delete({ where: { id: params.id } })
    return NextResponse.json({ message: 'Borrador eliminado' })
  } catch (error) {
    console.error('[SOLICITUD COMPRA DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
