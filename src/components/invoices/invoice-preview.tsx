'use client'

import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Printer, Mail, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate, formatMoneyExact } from '@/lib/utils'
import { loadLogoForPdf, drawPdfHeader, drawBrandedFooter } from '@/lib/pdf-branding'
import toast from 'react-hot-toast'

interface InvoiceData {
  id: string
  amount: number
  currency: string
  status: string
  description: string | null
  dueDate: string
  paidAt: string | null
  createdAt: string
  empresa: { name: string; address?: string | null; city?: string | null; province?: string | null } | null
  client?: { name: string } | null
}

interface OrgBilling {
  name: string
  logoUrl: string | null
  crmName: string
  primaryColor?: string | null
  billingAddress: string | null
  billingEmail: string | null
  billingPhone: string | null
  billingTaxId: string | null
  paymentInstructions: string | null
}

interface FullInvoice {
  numeroInterno: string | null
  tipo: string | null
  subtotal: number | null
  iva: number | null
  sentAt: string | null
  recipientEmail: string | null
  items: Array<{ id: string; nombre: string; cantidad: number; precioUnitario: number; ivaPct: number | null; subtotal: number }>
}

const STATUS_LABELS: Record<string, string> = { PENDING: 'Pendiente', PAID: 'Pagada', OVERDUE: 'Vencida', CANCELLED: 'Cancelada' }
const STATUS_COLORS: Record<string, string> = { PENDING: '#f59e0b', PAID: '#22c55e', OVERDUE: '#ef4444', CANCELLED: '#94a3b8' }

export function InvoicePreview({ invoice, onClose }: { invoice: InvoiceData; onClose: () => void }) {
  const qc = useQueryClient()
  const printRef = useRef<HTMLDivElement>(null)
  const [sending, setSending] = useState(false)

  const { data: org } = useQuery<OrgBilling | null>({
    queryKey: ['org-branding'],
    queryFn: async () => (await fetch('/api/settings/branding')).json().then((j) => j.data ?? null),
    staleTime: 5 * 60 * 1000,
  })

  const { data: full } = useQuery<FullInvoice | null>({
    queryKey: ['invoice-full', invoice.id],
    queryFn: async () => (await fetch(`/api/invoices/${invoice.id}`)).json().then((j) => j.data ?? null),
  })

  const invoiceNumber = full?.numeroInterno ?? invoice.id.slice(-8).toUpperCase()
  const statusColor = STATUS_COLORS[invoice.status] ?? '#94a3b8'
  const statusLabel = STATUS_LABELS[invoice.status] ?? invoice.status
  const items = full?.items ?? []

  const handlePrint = () => {
    const content = printRef.current
    if (!content) return
    const win = window.open('', '_blank', 'width=800,height=900')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Factura ${invoiceNumber}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;background:#fff}.invoice{padding:48px;max-width:800px;margin:0 auto}</style></head><body><div class="invoice">${content.innerHTML}</div></body></html>`)
    win.document.close(); win.focus(); win.print(); win.close()
  }

  const enviarPorMail = async () => {
    setSending(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pw = 210, mg = 20, cw = pw - mg * 2
      const hex = (org?.primaryColor || '#6366f1').replace('#', '')
      const pr = parseInt(hex.slice(0, 2), 16), pg = parseInt(hex.slice(2, 4), 16), pb = parseInt(hex.slice(4, 6), 16)
      const logo = await loadLogoForPdf(org?.logoUrl)

      const headerH = drawPdfHeader(doc, {
        pw, mg, pr, pg, pb, logo,
        orgName: org?.name || org?.crmName || 'Empresa',
        kicker: 'Factura',
        dateLabel: new Date(invoice.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }),
      })
      let y = headerH + 14
      doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
      doc.text(`Factura ${invoiceNumber}`, mg, y); y += 7
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 116, 139)
      doc.text(`Cliente: ${invoice.empresa?.name ?? invoice.client?.name ?? 'Sin cliente'}`, mg, y); y += 5
      doc.text(`Vencimiento: ${new Date(invoice.dueDate).toLocaleDateString('es-AR')}`, mg, y); y += 9

      doc.setFillColor(241, 245, 249); doc.rect(mg, y, cw, 8, 'F')
      doc.setTextColor(148, 163, 184); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
      doc.text('DESCRIPCIÓN', mg + 2, y + 5.5)
      doc.text('CANT.', mg + cw * 0.62, y + 5.5, { align: 'right' })
      doc.text('IMPORTE', mg + cw - 2, y + 5.5, { align: 'right' })
      y += 8
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
      const rows = items.length ? items : [{ nombre: invoice.description || 'Servicio', cantidad: 1, subtotal: invoice.amount }]
      rows.forEach((it: any, idx: number) => {
        if (y > 262) { doc.addPage(); y = 20 }
        if (idx % 2 === 1) { doc.setFillColor(248, 250, 252); doc.rect(mg, y, cw, 8, 'F') }
        doc.setTextColor(30, 41, 59)
        doc.text(String(it.nombre).slice(0, 60), mg + 2, y + 5.5)
        doc.text(String(it.cantidad ?? 1), mg + cw * 0.62, y + 5.5, { align: 'right' })
        doc.text(formatMoneyExact(it.subtotal ?? 0, invoice.currency), mg + cw - 2, y + 5.5, { align: 'right' })
        y += 8
      })
      y += 4
      if (y > 240) { doc.addPage(); y = 20 }
      doc.setDrawColor(226, 232, 240); doc.line(mg + cw - 70, y, mg + cw, y); y += 6
      if (full?.subtotal != null) {
        doc.setTextColor(100, 116, 139); doc.setFontSize(9)
        doc.text('Subtotal', mg + cw - 70, y); doc.text(formatMoneyExact(full.subtotal, invoice.currency), mg + cw - 2, y, { align: 'right' }); y += 5
        if (full.iva) { doc.text('IVA', mg + cw - 70, y); doc.text(formatMoneyExact(full.iva, invoice.currency), mg + cw - 2, y, { align: 'right' }); y += 5 }
      }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(30, 41, 59)
      doc.text('TOTAL', mg + cw - 70, y + 1)
      doc.text(formatMoneyExact(invoice.amount, invoice.currency), mg + cw - 2, y + 1, { align: 'right' })
      y += 14

      if (org?.paymentInstructions) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
        doc.text(doc.splitTextToSize(`Pago: ${org.paymentInstructions}`, cw), mg, y)
        y += 16
      }
      drawBrandedFooter(doc, { pw, mg, y, pr, pg, pb, leftText: org?.name || org?.crmName || '' })

      const pdfBase64 = doc.output('datauristring') as unknown as string
      // Vercel corta el request body en ~4.5 MB (413, "Request Entity Too
      // Large") — que además vuelve como HTML, no JSON, así que el catch de
      // abajo sólo mostraría "No se pudo enviar". Chequeo acá con un mensaje
      // claro. Con el downscale del logo (pdf-branding.ts) esto no debería
      // pasar nunca, pero por las dudas.
      if (pdfBase64.length > 4_000_000) {
        toast.error('El PDF quedó muy pesado (logo muy grande). Cambiá el logo por uno más chico en Configuración → Marca.')
        return
      }
      const res = await fetch(`/api/invoices/${invoice.id}/enviar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64, email: full?.recipientEmail ?? undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error ?? `No se pudo enviar (${res.status})`); return }
      toast.success(json.message)
      qc.invalidateQueries({ queryKey: ['invoice-full', invoice.id] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    } catch (err) {
      console.error(err)
      toast.error('No se pudo enviar la factura')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 shrink-0 flex-wrap" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <span className="text-sm font-semibold shrink-0" style={{ color: 'var(--color-text)' }}>
            Factura {invoiceNumber}{full?.sentAt ? ' · enviada' : ''}
          </span>
          <div className="flex items-center gap-1.5">
            <button onClick={enviarPorMail} disabled={sending}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all disabled:opacity-60"
              style={{ background: 'var(--color-primary)', color: '#fff' }}>
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              <span>{sending ? 'Enviando...' : 'Enviar por mail'}</span>
            </button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium"
              style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text)' }}>
              <Printer size={14} /> <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-raised)]" style={{ color: 'var(--color-text-muted)' }}>
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6" style={{ background: '#f1f5f9' }}>
          <div ref={printRef} className="rounded-xl p-8 space-y-8" style={{ background: '#fff', minHeight: '640px', boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-center gap-4">
                {org?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.logoUrl} alt={org.name} className="h-12 w-auto object-contain" />
                ) : (
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                    {(org?.name ?? org?.crmName ?? 'C').charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-bold text-lg" style={{ color: '#1e293b' }}>{org?.name ?? org?.crmName ?? 'Empresa'}</p>
                  {org?.billingTaxId && <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>CUIT: {org.billingTaxId}</p>}
                  {org?.billingAddress && <p className="text-xs" style={{ color: '#64748b' }}>{org.billingAddress}</p>}
                  {org?.billingEmail && <p className="text-xs" style={{ color: '#64748b' }}>{org.billingEmail}</p>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-3xl font-bold" style={{ color: '#1e293b' }}>FACTURA</p>
                <p className="text-sm mt-1" style={{ color: '#64748b' }}>{invoiceNumber}</p>
                <div className="mt-2 inline-block px-3 py-1 rounded-full text-xs font-semibold" style={{ background: `${statusColor}20`, color: statusColor }}>{statusLabel}</div>
              </div>
            </div>

            <div style={{ borderTop: '2px solid #e2e8f0' }} />

            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>Facturar a</p>
                <p className="font-semibold" style={{ color: '#1e293b' }}>{invoice.empresa?.name ?? invoice.client?.name ?? 'Sin cliente'}</p>
                {invoice.empresa?.address && <p className="text-sm" style={{ color: '#64748b' }}>{invoice.empresa.address}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>Fechas</p>
                <div className="flex justify-between gap-6"><span className="text-sm" style={{ color: '#64748b' }}>Emisión</span><span className="text-sm font-medium" style={{ color: '#1e293b' }}>{formatDate(invoice.createdAt)}</span></div>
                <div className="flex justify-between gap-6"><span className="text-sm" style={{ color: '#64748b' }}>Vencimiento</span><span className="text-sm font-medium" style={{ color: '#1e293b' }}>{formatDate(invoice.dueDate)}</span></div>
                {invoice.paidAt && <div className="flex justify-between gap-6"><span className="text-sm" style={{ color: '#64748b' }}>Pagada</span><span className="text-sm font-medium" style={{ color: '#22c55e' }}>{formatDate(invoice.paidAt)}</span></div>}
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Descripción</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>Cant.</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>Importe</th>
                </tr>
              </thead>
              <tbody>
                {(items.length ? items : [{ id: 'x', nombre: invoice.description || 'Servicio', cantidad: 1, subtotal: invoice.amount }]).map((it: any) => (
                  <tr key={it.id}>
                    <td style={{ padding: '12px 16px', color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}>{it.nombre}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>{it.cantidad ?? 1}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}>{formatCurrency(it.subtotal ?? 0, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px 24px', minWidth: '240px' }}>
                {full?.subtotal != null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#64748b', fontSize: '14px' }}>Subtotal</span>
                    <span style={{ color: '#1e293b', fontSize: '14px' }}>{formatCurrency(full.subtotal, invoice.currency)}</span>
                  </div>
                )}
                {full?.iva ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#64748b', fontSize: '14px' }}>IVA</span>
                    <span style={{ color: '#1e293b', fontSize: '14px' }}>{formatCurrency(full.iva, invoice.currency)}</span>
                  </div>
                ) : null}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#1e293b', fontWeight: 700, fontSize: '16px' }}>TOTAL</span>
                  <span style={{ color: '#1e293b', fontWeight: 700, fontSize: '20px' }}>{formatCurrency(invoice.amount, invoice.currency)}</span>
                </div>
              </div>
            </div>

            {org?.paymentInstructions && (
              <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px 20px', borderLeft: '3px solid #6366f1' }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#6366f1', textTransform: 'uppercase', marginBottom: '6px' }}>Instrucciones de pago</p>
                <p style={{ fontSize: '13px', color: '#475569', whiteSpace: 'pre-line' }}>{org.paymentInstructions}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
