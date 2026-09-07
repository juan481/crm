import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { billAbonosForOrg } from '@/lib/billing-recurrente'

export const dynamic = 'force-dynamic'

// Genera a mano las facturas de los abonos que corresponden a este mes (para
// un abono cargado después de que corrió el cron del día 1, o para probar).
// GET = preview, POST = genera. Es idempotente: no duplica facturas ya emitidas.
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const preview = await billAbonosForOrg(payload.orgId, { dryRun: true })
    return NextResponse.json({ data: preview })
  } catch (error) {
    console.error('[SERVICIOS-RECURRENTES GENERAR GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(_req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const res = await billAbonosForOrg(payload.orgId, {})
    return NextResponse.json({
      data: res,
      message: res.created > 0
        ? `${res.created} factura${res.created !== 1 ? 's' : ''} generada${res.created !== 1 ? 's' : ''}`
        : 'No había abonos pendientes de facturar este mes',
    })
  } catch (error) {
    console.error('[SERVICIOS-RECURRENTES GENERAR POST]', error)
    return NextResponse.json({ error: 'Error al generar facturas' }, { status: 500 })
  }
}
