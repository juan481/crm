'use client'

import { useEffect, useState, useRef } from 'react'
import { X, Printer, Download } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface InvoiceData {
  id: string
  amount: number
  currency: string
  status: string
  description: string | null
  dueDate: string
  paidAt: string | null
  createdAt: string
  client: { name: string; email: string; company?: string | null; address?: string | null }
}

interface OrgBilling {
  name: string
  logoUrl: string | null
  crmName: string
  billingAddress: string | null
  billingEmail: string | null
  billingPhone: string | null
  billingTaxId: string | null
  paymentInstructions: string | null
}

interface InvoicePreviewProps {
  invoice: InvoiceData
  onClose: () => void
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  PAID: 'Pagada',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelada',
}
const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  PAID: '#22c55e',
  OVERDUE: '#ef4444',
  CANCELLED: '#94a3b8',
}

export function InvoicePreview({ invoice, onClose }: InvoicePreviewProps) {
  const [org, setOrg] = useState<OrgBilling | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/settings/branding')
      .then((r) => r.json())
      .then(({ data }) => { if (data) setOrg(data) })
      .catch(() => {})
  }, [])

  const handlePrint = () => {
    const content = printRef.current
    if (!content) return
    const win = window.open('', '_blank', 'width=800,height=900')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Factura</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; background: #fff; }
            .invoice { padding: 48px; max-width: 800px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="invoice">${content.innerHTML}</div>
        </body>
      </html>
    `)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

  const invoiceNumber = invoice.id.slice(-8).toUpperCase()
  const statusColor = STATUS_COLORS[invoice.status] ?? '#94a3b8'
  const statusLabel = STATUS_LABELS[invoice.status] ?? invoice.status

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            Vista previa · Factura #{invoiceNumber}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text)' }}>
              <Printer size={14} />
              Imprimir / PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-surface-raised)]"
              style={{ color: 'var(--color-text-muted)' }}>
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Scrollable preview */}
        <div className="overflow-y-auto flex-1 p-6" style={{ background: '#f1f5f9' }}>
          {/* Paper */}
          <div ref={printRef} className="rounded-xl p-8 space-y-8" style={{ background: '#fff', minHeight: '640px', boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>

            {/* Header */}
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-center gap-4">
                {org?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.logoUrl} alt={org.name} className="h-12 w-auto object-contain" />
                ) : (
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                    {(org?.name ?? org?.crmName ?? 'C').charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-bold text-lg" style={{ color: '#1e293b' }}>{org?.name ?? org?.crmName ?? 'Empresa'}</p>
                  {org?.billingTaxId && <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>CUIT/RUT: {org.billingTaxId}</p>}
                  {org?.billingAddress && <p className="text-xs" style={{ color: '#64748b' }}>{org.billingAddress}</p>}
                  {org?.billingEmail && <p className="text-xs" style={{ color: '#64748b' }}>{org.billingEmail}</p>}
                  {org?.billingPhone && <p className="text-xs" style={{ color: '#64748b' }}>{org.billingPhone}</p>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-3xl font-bold" style={{ color: '#1e293b' }}>FACTURA</p>
                <p className="text-sm mt-1" style={{ color: '#64748b' }}>#{invoiceNumber}</p>
                <div className="mt-2 inline-block px-3 py-1 rounded-full text-xs font-semibold"
                  style={{ background: `${statusColor}20`, color: statusColor }}>
                  {statusLabel}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: '2px solid #e2e8f0' }} />

            {/* Bill to + Dates */}
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>Facturar a</p>
                <p className="font-semibold" style={{ color: '#1e293b' }}>{invoice.client.name}</p>
                {invoice.client.company && <p className="text-sm" style={{ color: '#64748b' }}>{invoice.client.company}</p>}
                <p className="text-sm" style={{ color: '#64748b' }}>{invoice.client.email}</p>
                {invoice.client.address && <p className="text-sm" style={{ color: '#64748b' }}>{invoice.client.address}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>Fechas</p>
                <div className="space-y-1">
                  <div className="flex justify-between gap-6">
                    <span className="text-sm" style={{ color: '#64748b' }}>Emisión</span>
                    <span className="text-sm font-medium" style={{ color: '#1e293b' }}>{formatDate(invoice.createdAt)}</span>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span className="text-sm" style={{ color: '#64748b' }}>Vencimiento</span>
                    <span className="text-sm font-medium" style={{ color: '#1e293b' }}>{formatDate(invoice.dueDate)}</span>
                  </div>
                  {invoice.paidAt && (
                    <div className="flex justify-between gap-6">
                      <span className="text-sm" style={{ color: '#64748b' }}>Pagada</span>
                      <span className="text-sm font-medium" style={{ color: '#22c55e' }}>{formatDate(invoice.paidAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items table */}
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderRadius: '8px 0 0 8px' }}>Descripción</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderRadius: '0 8px 8px 0' }}>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '14px 16px', color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}>
                      {invoice.description || 'Servicio'}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}>
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div className="flex justify-end">
              <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px 24px', minWidth: '240px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '14px' }}>Subtotal</span>
                  <span style={{ color: '#1e293b', fontSize: '14px', fontWeight: 500 }}>{formatCurrency(invoice.amount, invoice.currency)}</span>
                </div>
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#1e293b', fontWeight: 700, fontSize: '16px' }}>TOTAL</span>
                  <span style={{ color: '#1e293b', fontWeight: 700, fontSize: '20px' }}>{formatCurrency(invoice.amount, invoice.currency)}</span>
                </div>
              </div>
            </div>

            {/* Payment instructions */}
            {org?.paymentInstructions && (
              <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px 20px', borderLeft: '3px solid #6366f1' }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Instrucciones de pago</p>
                <p style={{ fontSize: '13px', color: '#475569', whiteSpace: 'pre-line' }}>{org.paymentInstructions}</p>
              </div>
            )}

            {/* Footer */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                {org?.name ?? ''}{org?.billingEmail ? ` · ${org.billingEmail}` : ''}{org?.billingPhone ? ` · ${org.billingPhone}` : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
