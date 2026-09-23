import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sanitizeMoneda } from '@/lib/servicios-recurrentes'

export const dynamic = 'force-dynamic'

function str(v: unknown): string { return typeof v === 'string' ? v.trim() : '' }

// Ajuste de precio en masa — el pedido de Abba: el abono se actualiza
// trimestralmente y el monto tiene que poder cambiarse una sola vez para
// TODOS los clientes que ya tienen ese mismo servicio activo, en vez de
// editar cada ServicioRecurrente uno por uno. Se agrupa por nombre+moneda
// (mismo criterio que el MRR del endpoint GET) y sólo toca los ACTIVO — un
// abono PAUSADO/BAJA no se toca (no está cobrando, no corresponde re-precio).
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const b = await req.json().catch(() => ({}))
    const nombre = str(b.nombre)
    if (!nombre) return NextResponse.json({ error: 'Falta el nombre del servicio' }, { status: 400 })
    const moneda = sanitizeMoneda(b.moneda)
    const monto = Number(b.monto)
    if (!Number.isFinite(monto) || monto < 0) return NextResponse.json({ error: 'El monto no es válido' }, { status: 400 })

    const where = { organizationId: payload.orgId, nombre, moneda, estado: 'ACTIVO' as const }
    const affected = await prisma.servicioRecurrente.count({ where })
    if (affected === 0) {
      return NextResponse.json({ error: `No hay ningún abono activo llamado "${nombre}" en ${moneda}.` }, { status: 404 })
    }

    await prisma.servicioRecurrente.updateMany({ where, data: { monto } })

    return NextResponse.json({ ok: true, updated: affected })
  } catch (error) {
    console.error('[SERVICIOS-RECURRENTES BULK-UPDATE]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}
