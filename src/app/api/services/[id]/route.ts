import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

// Mismo motivo que en src/app/api/services/route.ts (POST) — ver ahí.
const VALID_CURRENCIES = new Set(['USD', 'ARS', 'EUR'])

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN') && !(await roleHasModule(payload.orgId, payload.role, 'catalogo-gestion'))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const existing = await prisma.service.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
    })
    if (!existing) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })

    const { name, description, price, currency, billingCycle } = await req.json()
    if (currency !== undefined && !VALID_CURRENCIES.has(currency)) {
      return NextResponse.json({ error: `Moneda inválida: "${currency}". Usá USD, ARS o EUR.` }, { status: 400 })
    }

    const service = await prisma.service.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: Number(price) }),
        ...(currency && { currency }),
        ...(billingCycle && { billingCycle }),
      },
      include: { _count: { select: { clients: true } } },
    })

    return NextResponse.json({ data: service })
  } catch (error) {
    console.error('[SERVICE PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN') && !(await roleHasModule(payload.orgId, payload.role, 'catalogo-gestion'))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    // Un servicio que es componente de algún KIT no se puede hard-borrar
    // (ProductComponent.serviceComponent es onDelete: Restrict) — Postgres
    // tiraría un P2003 y la request moría con 500. Mismo criterio que
    // products/[id] (DELETE): se avisa cuál/es KIT lo usan.
    const db = prisma as any
    const enKits = await db.productComponent.findMany({
      where: { serviceComponentId: params.id, organizationId: payload.orgId },
      select: { kit: { select: { name: true } } },
    })
    if (enKits.length > 0) {
      const nombres = Array.from(new Set(enKits.map((c: any) => c.kit?.name).filter(Boolean)))
      return NextResponse.json({
        error: `Este servicio es componente de ${enKits.length === 1 ? 'un KIT' : 'varios KITs'}: ${nombres.join(', ')}. Sacalo de ${enKits.length === 1 ? 'ese KIT' : 'esos KITs'} primero.`,
      }, { status: 409 })
    }

    await prisma.service.deleteMany({
      where: { id: params.id, organizationId: payload.orgId },
    })

    return NextResponse.json({ message: 'Servicio eliminado' })
  } catch (error) {
    console.error('[SERVICE DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
