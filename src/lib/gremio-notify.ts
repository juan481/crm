import { waitUntil } from '@vercel/functions'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/email'

const DEFAULT_INBOX = 'info@abbaseguridad.com.ar'

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

interface OrderItem {
  name: string
  sku: string | null
  quantity: number
  precioGremio: number
  precioPublico: number
}

interface NotifyOrderOpts {
  pedidoId: string
  number: number
  buyerName: string
  buyerEmail: string
  items: OrderItem[]
  totalGremio: number
  totalPublico: number
  ahorro: number
  currency: string
  notifyEmail?: string | null
  notes?: string | null
}

// Mismo patrón que api/suggestions/route.ts: manda SIEMPRE por el SMTP
// global de la agencia (process.env.SMTP_FROM), no por el smtp propio de la
// organización — así el aviso de un pedido nuevo llega aunque el SMTP/SES
// de Abba esté mal configurado o caído.
async function doNotifyGremioOrder(opts: NotifyOrderOpts): Promise<void> {
  const money = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: opts.currency, minimumFractionDigits: 0 }).format(n)

  const rows = opts.items.map((i) =>
    `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(i.name)}${i.sku ? ` <span style="color:#94a3b8;">(${escapeHtml(i.sku)})</span>` : ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;">${i.quantity}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${money(i.precioGremio * i.quantity)}</td>
    </tr>`
  ).join('')

  const html = `
    <p><strong>Pedido #${String(opts.number).padStart(3, '0')}</strong> — hecho por ${escapeHtml(opts.buyerName)} (${escapeHtml(opts.buyerEmail)}) desde el portal Gremio.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:6px 8px;text-align:left;">Producto</th>
          <th style="padding:6px 8px;text-align:center;">Cant.</th>
          <th style="padding:6px 8px;text-align:right;">Total Gremio</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:10px;">
      Total Gremio: <strong>${money(opts.totalGremio)}</strong><br/>
      Total Público (referencia): ${money(opts.totalPublico)}<br/>
      Ahorro para el cliente: <strong style="color:#10b981;">${money(opts.ahorro)}</strong>
    </p>
    ${opts.notes ? `<p style="margin-top:10px;"><strong>Notas del cliente:</strong><br/>${escapeHtml(opts.notes).replace(/\n/g, '<br/>')}</p>` : ''}
  `

  await sendEmail({
    to: opts.notifyEmail || DEFAULT_INBOX,
    from: process.env.SMTP_FROM,
    subject: `Pedido [${String(opts.number).padStart(3, '0')}]: Gremio`,
    html,
  })

  const db = prisma as any
  await db.pedido.update({ where: { id: opts.pedidoId }, data: { emailSentAt: new Date() } }).catch(() => {})
}

// waitUntil, no fire-and-forget a secas — mismo motivo que
// whatsapp-bot/notify.ts: en serverless de Vercel una promesa no esperada
// puede cortarse a mitad de camino apenas se manda la respuesta al
// cliente. La creación del Pedido en sí no depende de que este mail salga.
export function notifyGremioOrder(opts: NotifyOrderOpts): void {
  waitUntil(doNotifyGremioOrder(opts).catch((err) => console.error('[GREMIO ORDER EMAIL]', err)))
}
