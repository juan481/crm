import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { billAbonosForOrg, getBillingConfig } from '@/lib/billing-recurrente'
import { sendInvoiceEmail } from '@/lib/invoice-email'

export const dynamic = 'force-dynamic'

// Genera a mano las facturas de los abonos que corresponden a este mes (para
// un abono cargado después de que corrió el cron del día 1, o para probar).
// GET = preview, POST = genera. Es idempotente: no duplica facturas ya emitidas.
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { dueSameMonth } = await getBillingConfig(payload.orgId)
    const preview = await billAbonosForOrg(payload.orgId, { dryRun: true, dueSameMonth })
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

    const { dueSameMonth, autoSend } = await getBillingConfig(payload.orgId)
    const res = await billAbonosForOrg(payload.orgId, { dueSameMonth })

    // Si la org tiene autoSend, las manda al cliente también desde el botón manual.
    let sent = 0
    if (autoSend) {
      for (const id of res.createdInvoiceIds) {
        try { if ((await sendInvoiceEmail({ invoiceId: id, organizationId: payload.orgId, req: _req })).ok) sent++ }
        catch (err) { console.error('[SERVICIOS-RECURRENTES GENERAR] auto-envío falló:', id, err) }
      }
    }

    return NextResponse.json({
      data: res,
      message: res.created > 0
        ? `${res.created} factura${res.created !== 1 ? 's' : ''} generada${res.created !== 1 ? 's' : ''}${autoSend ? ` · ${sent} enviada${sent !== 1 ? 's' : ''} al cliente` : ''}`
        : 'No había abonos pendientes de facturar este mes',
    })
  } catch (error) {
    console.error('[SERVICIOS-RECURRENTES GENERAR POST]', error)
    return NextResponse.json({ error: 'Error al generar facturas' }, { status: 500 })
  }
}
