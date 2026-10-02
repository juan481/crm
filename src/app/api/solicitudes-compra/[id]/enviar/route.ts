import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { puedeVerCompras } from '@/lib/stock-access'
import { prisma } from '@/lib/db'
import { sendEmail, resolveOrgSmtpConfig, buildEmailHtml, isOrgEmailConfigured } from '@/lib/email'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

// Código + producto + costo + cantidad, agrupado por moneda si hace falta
// — sin fechas de entrega a propósito (pedido explícito de Abba: la
// prioridad es que el importador tenga qué despachar, no gestionar plazos).
function buildPedidoHtml(opts: {
  items: { sku: string | null; nombre: string; cantidad: number; costoUnitario: number; moneda: string }[]
  condicionPago: string | null
  notas: string | null
  numero: number
}): string {
  const rows = opts.items.map((it) => `
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:8px 6px;font-family:monospace;font-size:13px">${it.sku ?? '—'}</td>
      <td style="padding:8px 6px">${it.nombre}</td>
      <td style="padding:8px 6px;text-align:center">${it.cantidad}</td>
      <td style="padding:8px 6px;text-align:right">${formatMoney(it.costoUnitario, it.moneda)}</td>
      <td style="padding:8px 6px;text-align:right;font-weight:600">${formatMoney(it.costoUnitario * it.cantidad, it.moneda)}</td>
    </tr>`).join('')

  const totalesPorMoneda = new Map<string, number>()
  for (const it of opts.items) {
    totalesPorMoneda.set(it.moneda, (totalesPorMoneda.get(it.moneda) ?? 0) + it.costoUnitario * it.cantidad)
  }
  const totalesHtml = Array.from(totalesPorMoneda.entries())
    .map(([moneda, total]) => `<p style="margin:2px 0;font-weight:700">Total ${moneda}: ${formatMoney(total, moneda)}</p>`)
    .join('')

  return `
    <p>Pedido <strong>N° ${opts.numero}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:12px 0">
      <thead>
        <tr style="border-bottom:2px solid #1e293b;text-align:left">
          <th style="padding:8px 6px">Código</th>
          <th style="padding:8px 6px">Producto</th>
          <th style="padding:8px 6px;text-align:center">Cant.</th>
          <th style="padding:8px 6px;text-align:right">Costo unit.</th>
          <th style="padding:8px 6px;text-align:right">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${totalesHtml}
    ${opts.condicionPago ? `<p><strong>Condición de pago:</strong> ${opts.condicionPago}</p>` : ''}
    ${opts.notas ? `<p><strong>Notas:</strong> ${opts.notas}</p>` : ''}
    <p>Por favor confirmanos disponibilidad de cada ítem. Gracias.</p>
  `
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const db = prisma as any
    const solicitud = await db.solicitudCompra.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      include: { items: true, proveedor: { select: { id: true, name: true } } },
    })
    if (!solicitud) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    if (solicitud.estado !== 'BORRADOR') return NextResponse.json({ error: 'Ya se envió' }, { status: 409 })
    if (!solicitud.proveedorId) return NextResponse.json({ error: 'Elegí el proveedor antes de enviar' }, { status: 400 })
    if (solicitud.items.length === 0) return NextResponse.json({ error: 'Agregá al menos un producto' }, { status: 400 })

    const { contactoEmail, contactoNombre } = await req.json().catch(() => ({}))
    const email = (contactoEmail ?? solicitud.contactoEmail)?.trim()
    if (!email) return NextResponse.json({ error: 'Falta el mail del proveedor para mandar el pedido' }, { status: 400 })

    const org = await prisma.organization.findUnique({
      where: { id: payload.orgId },
      select: {
        name: true, crmName: true, primaryColor: true, secondaryColor: true,
        smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
        smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
      },
    })
    if (!isOrgEmailConfigured(org)) {
      return NextResponse.json({ error: 'No hay un mail configurado para esta organización (Configuración → Email)' }, { status: 400 })
    }

    const last = await db.solicitudCompra.findFirst({
      where: { organizationId: payload.orgId, numero: { not: null } },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    })
    const numero = (last?.numero ?? 0) + 1

    const html = buildEmailHtml(
      `Pedido N° ${numero} — ${org?.name || org?.crmName || 'CRM'}`,
      buildPedidoHtml({ items: solicitud.items, condicionPago: solicitud.condicionPago, notas: solicitud.notas, numero }),
      org?.name || org?.crmName || 'CRM Pro',
      org?.primaryColor || '#6366f1',
      org?.secondaryColor || '#8b5cf6',
      undefined, undefined, true,
    )

    await sendEmail({
      to: email,
      subject: `Pedido N° ${numero} — ${solicitud.proveedor?.name ?? 'Proveedor'}`,
      html,
      smtpConfig: resolveOrgSmtpConfig(org),
    })

    const updated = await db.solicitudCompra.update({
      where: { id: params.id },
      data: {
        estado: 'ENVIADA',
        numero,
        enviadoAt: new Date(),
        contactoEmail: email,
        contactoNombre: contactoNombre?.trim() || solicitud.contactoNombre || null,
      },
      select: { id: true, numero: true, estado: true },
    })

    return NextResponse.json({ message: `Pedido N° ${numero} enviado`, data: updated })
  } catch (error) {
    console.error('[SOLICITUD COMPRA ENVIAR]', error)
    return NextResponse.json({ error: 'Error al enviar el pedido' }, { status: 500 })
  }
}
