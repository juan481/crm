import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { KIT_SELECT, withKitMetrics, resolveComponents, type ComponentInput } from '@/lib/kits'

export const dynamic = 'force-dynamic'

interface Params { params: { id: string } }
const VALID_CURRENCIES = new Set(['USD', 'ARS', 'EUR'])

async function loadKit(db: any, id: string, orgId: string) {
  return db.product.findFirst({ where: { id, organizationId: orgId, isKit: true }, select: KIT_SELECT })
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const kit = await loadKit(prisma as any, params.id, payload.orgId)
    if (!kit) return NextResponse.json({ error: 'KIT no encontrado' }, { status: 404 })
    return NextResponse.json({ data: withKitMetrics({ ...kit, createdAt: kit.createdAt.toISOString() }) })
  } catch (error) {
    console.error('[KIT GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const existing = await loadKit(db, params.id, payload.orgId)
    if (!existing) return NextResponse.json({ error: 'KIT no encontrado' }, { status: 404 })

    const body = await req.json()
    const { name, description, price, currency, unit, active, components } = body as {
      name?: string; description?: string; price?: number; currency?: string
      unit?: string; active?: boolean; components?: ComponentInput[]
    }

    if (name !== undefined && !name.trim())
      return NextResponse.json({ error: 'El nombre no puede quedar vacío' }, { status: 400 })
    if (price !== undefined && (isNaN(Number(price)) || Number(price) < 0))
      return NextResponse.json({ error: 'El precio del KIT debe ser ≥ 0' }, { status: 400 })
    if (currency !== undefined && !VALID_CURRENCIES.has(currency))
      return NextResponse.json({ error: `Moneda inválida: "${currency}".` }, { status: 400 })

    let resolved: Awaited<ReturnType<typeof resolveComponents>> | null = null
    if (components !== undefined) {
      if (!Array.isArray(components) || components.length === 0)
        return NextResponse.json({ error: 'Un KIT necesita al menos un componente' }, { status: 400 })
      resolved = await resolveComponents(payload.orgId, components)
      const bad = resolved.filter((r) => r.error)
      if (bad.length) {
        return NextResponse.json({
          error: 'Hay componentes que no se pudieron resolver',
          detalle: bad.map((b) => ({ codigo: b.sku ?? b.input.productId, motivo: b.error })),
        }, { status: 400 })
      }
    }

    const kit = await db.$transaction(async (tx: any) => {
      await tx.product.update({
        where: { id: params.id },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(description !== undefined && { description: description?.trim() || null }),
          ...(price !== undefined && { price: Number(price) }),
          ...(currency !== undefined && { currency }),
          ...(unit !== undefined && { unit: unit?.trim() || 'kit' }),
          ...(active !== undefined && { active: !!active }),
        },
      })
      if (resolved) {
        await tx.productComponent.deleteMany({ where: { kitId: params.id } })
        await tx.productComponent.createMany({
          data: resolved.map((r) => ({ kitId: params.id, componentId: r.productId!, quantity: r.quantity, organizationId: payload.orgId })),
        })
      }
      return tx.product.findUnique({ where: { id: params.id }, select: KIT_SELECT })
    })

    return NextResponse.json({ data: withKitMetrics({ ...kit, createdAt: kit.createdAt.toISOString() }) })
  } catch (error) {
    console.error('[KIT PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar el KIT' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    // deleteMany (no delete) para que un id inexistente o de otra org no tire
    // 500 — mismo criterio que el resto del código. onDelete Cascade de
    // ProductComponent.kit se lleva los renglones de la receta.
    const res = await db.product.deleteMany({ where: { id: params.id, organizationId: payload.orgId, isKit: true } })
    if (res.count === 0) return NextResponse.json({ error: 'KIT no encontrado' }, { status: 404 })
    return NextResponse.json({ message: 'KIT eliminado' })
  } catch (error) {
    console.error('[KIT DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar el KIT' }, { status: 500 })
  }
}
