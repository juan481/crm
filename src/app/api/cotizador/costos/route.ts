import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { roleHasModule } from '@/lib/module-access'

export const dynamic = 'force-dynamic'

// POST /api/cotizador/costos — { productIds: string[] } → costo unitario (USD)
// de cada producto del carrito, para mostrar la GANANCIA mientras se cotiza
// (pedido de Seba, Abba 2026-11-25: "cotizo a un integrador, veo que puedo
// mejorar el precio y lo modifico").
//
// Mismo criterio de visibilidad que el costo en /api/products: ADMIN+ o quien
// tenga Compras / Catálogo. Sin permiso → 403 y el cotizador no muestra nada
// de ganancia (un vendedor no ve los costos).
//
// KIT: costo = Σ costo de sus productos componentes × cantidad. `parcial` =
// algún componente sin costo cargado o un servicio (mano de obra, no tiene
// costo en el sistema) — la ganancia de ese kit queda sobreestimada.
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const puedeVerCosto =
      canAccess(payload.role, 'ADMIN') ||
      (await roleHasModule(payload.orgId, payload.role, 'compras')) ||
      (await roleHasModule(payload.orgId, payload.role, 'catalogo-gestion'))
    if (!puedeVerCosto) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json().catch(() => null)
    const ids = Array.isArray(body?.productIds)
      ? Array.from(new Set((body.productIds as unknown[]).filter((x): x is string => typeof x === 'string'))).slice(0, 300)
      : []
    if (ids.length === 0) return NextResponse.json({ data: {} })

    const db = prisma as any
    const rows = await db.product.findMany({
      where: { organizationId: payload.orgId, id: { in: ids } },
      select: {
        id: true, costo: true, isKit: true,
        kitComponents: {
          select: {
            quantity: true,
            component: { select: { costo: true } },
            serviceComponentId: true,
          },
        },
      },
    })

    const data: Record<string, { costo: number | null; parcial: boolean }> = {}
    for (const p of rows) {
      if (p.isKit && p.kitComponents?.length) {
        let costo = 0
        let conCosto = 0
        let parcial = false
        for (const c of p.kitComponents) {
          if (c.component && c.component.costo != null && c.component.costo > 0) {
            costo += c.component.costo * c.quantity
            conCosto++
          } else {
            parcial = true
          }
        }
        data[p.id] = conCosto > 0 ? { costo: Math.round(costo * 100) / 100, parcial } : { costo: null, parcial: false }
      } else {
        data[p.id] = { costo: p.costo != null && p.costo > 0 ? p.costo : null, parcial: false }
      }
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[COTIZADOR COSTOS]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
