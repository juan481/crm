import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { emitirFacturaDesdeCotizacion } from '@/lib/facturacion'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// POST /api/cotizaciones/[id]/emitir-factura — genera la factura de venta
// (registro + numeración interna, sin CAE). Body opcional: { dueDate, tipo }.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    // Facturación es ADMIN+ (mismo piso que el módulo `facturas`).
    if (!canAccess(payload.role as Role, 'ADMIN')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const dueDate = body?.dueDate && !isNaN(Date.parse(body.dueDate)) ? new Date(body.dueDate) : null

    const db = prisma as any
    const result = await db.$transaction(async (tx: any) => {
      const r = await emitirFacturaDesdeCotizacion(tx, params.id, payload.orgId, {
        dueDate,
        tipo: typeof body?.tipo === 'string' ? body.tipo : 'FACTURA',
      })
      if (!r.ok) throw Object.assign(new Error(r.error), { status: r.status })
      return r
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error: any) {
    if (error?.status) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Se emitió otra factura al mismo tiempo — probá de nuevo.' }, { status: 409 })
    }
    console.error('[EMITIR FACTURA]', error)
    return NextResponse.json({ error: 'Error al emitir la factura' }, { status: 500 })
  }
}
