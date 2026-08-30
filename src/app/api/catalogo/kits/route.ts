import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { KIT_SELECT, withKitMetrics, resolveComponents, type ComponentInput } from '@/lib/kits'

export const dynamic = 'force-dynamic'

const VALID_CURRENCIES = new Set(['USD', 'ARS', 'EUR'])

// ─── Listar KITs ──────────────────────────────────────────────────────────
export async function GET(_req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const kits = await db.product.findMany({
      where: { organizationId: payload.orgId, isKit: true },
      select: KIT_SELECT,
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ data: kits.map((k: any) => withKitMetrics({ ...k, createdAt: k.createdAt.toISOString() })) })
  } catch (error) {
    console.error('[KITS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ─── Crear KIT ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json()
    const { name, description, price, currency = 'ARS', unit = 'kit', components } = body as {
      name?: string; description?: string; price?: number; currency?: string; unit?: string; components?: ComponentInput[]
    }

    if (!name?.trim()) return NextResponse.json({ error: 'El nombre del KIT es requerido' }, { status: 400 })
    if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0)
      return NextResponse.json({ error: 'El precio final del KIT es requerido y debe ser ≥ 0' }, { status: 400 })
    if (!VALID_CURRENCIES.has(currency))
      return NextResponse.json({ error: `Moneda inválida: "${currency}". Usá USD, ARS o EUR.` }, { status: 400 })
    if (!Array.isArray(components) || components.length === 0)
      return NextResponse.json({ error: 'Un KIT necesita al menos un componente' }, { status: 400 })

    const resolved = await resolveComponents(payload.orgId, components)
    const bad = resolved.filter((r) => r.error)
    if (bad.length) {
      return NextResponse.json({
        error: 'Hay componentes que no se pudieron resolver',
        detalle: bad.map((b) => ({ codigo: b.sku ?? b.input.productId, motivo: b.error })),
      }, { status: 400 })
    }

    const db = prisma as any
    const kit = await db.$transaction(async (tx: any) => {
      const created = await tx.product.create({
        data: {
          organizationId: payload.orgId,
          name: name.trim(),
          description: description?.trim() || null,
          price: Number(price),
          currency,
          unit: unit?.trim() || 'kit',
          isKit: true,
          trackStock: false, // el stock del KIT se maneja sobre sus componentes
          catalogSource: null,
        },
        select: { id: true },
      })
      await tx.productComponent.createMany({
        data: resolved.map((r) => ({
          kitId: created.id,
          componentId: r.productId!,
          quantity: r.quantity,
          organizationId: payload.orgId,
        })),
      })
      return tx.product.findUnique({ where: { id: created.id }, select: KIT_SELECT })
    })

    return NextResponse.json({ data: withKitMetrics({ ...kit, createdAt: kit.createdAt.toISOString() }) }, { status: 201 })
  } catch (error) {
    console.error('[KITS POST]', error)
    return NextResponse.json({ error: 'Error al crear el KIT' }, { status: 500 })
  }
}
