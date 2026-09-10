import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { sendInvoiceEmail } from '@/lib/invoice-email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/invoices/[id]/enviar — manda la factura por mail con el PDF
// adjunto (generado en el cliente, base64). Body: { pdfBase64, email? }.
// La lógica vive en src/lib/invoice-email.ts (compartida con el cron
// invoice-automation, que la manda sin PDF).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const pdfBase64: string = body?.pdfBase64 ?? ''
    if (!pdfBase64) return NextResponse.json({ error: 'Falta el PDF' }, { status: 400 })

    const res = await sendInvoiceEmail({
      invoiceId: params.id,
      organizationId: payload.orgId,
      pdfBase64,
      requestedEmail: typeof body?.email === 'string' ? body.email : undefined,
      req,
    })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
    return NextResponse.json({ message: `Factura enviada a ${res.to}` })
  } catch (error) {
    console.error('[INVOICE ENVIAR]', error)
    return NextResponse.json({ error: 'Error al enviar la factura' }, { status: 500 })
  }
}
