'use client'

import { useEffect, useState } from 'react'
import { Loader2, CreditCard, CheckCircle2 } from 'lucide-react'

interface Factura {
  id: string
  numero: string
  concepto: string
  amount: number
  currency: string
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  dueDate: string
  paidAt: string | null
  payToken: string | null
}

function money(n: number, cur: string) {
  try { return new Intl.NumberFormat('es-AR', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(n) }
  catch { return `${cur} ${n.toFixed(2)}` }
}

const STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: '#f59e0b' },
  OVERDUE: { label: 'Vencida', color: '#ef4444' },
  PAID: { label: 'Pagada', color: '#10b981' },
  CANCELLED: { label: 'Anulada', color: 'var(--color-text-subtle)' },
}

export default function PortalFacturasPage() {
  const [rows, setRows] = useState<Factura[] | null>(null)

  useEffect(() => {
    fetch('/api/portal/facturas').then((r) => r.json()).then((j) => setRows(j.data ?? [])).catch(() => setRows([]))
  }, [])

  if (!rows) return <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--color-text-subtle)' }} /></div>

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Facturas</h1>

      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No tenés facturas todavía.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((f) => {
            const st = STATUS[f.status] ?? { label: f.status, color: 'var(--color-text-subtle)' }
            const payable = (f.status === 'PENDING' || f.status === 'OVERDUE') && f.payToken
            return (
              <div key={f.id} className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{f.concepto}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-subtle)' }}>
                      #{f.numero} · vence {new Date(f.dueDate).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{money(f.amount, f.currency)}</p>
                    <span className="text-[11px] font-medium" style={{ color: st.color }}>{st.label}</span>
                  </div>
                </div>
                {payable && (
                  <a
                    href={`/pagar/${f.payToken}`}
                    className="mt-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-white rounded-lg py-2"
                    style={{ background: 'var(--color-primary)' }}
                  >
                    <CreditCard size={14} /> Pagar
                  </a>
                )}
                {f.status === 'PAID' && (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs" style={{ color: '#10b981' }}>
                      <CheckCircle2 size={12} /> {f.paidAt ? `Pagada el ${new Date(f.paidAt).toLocaleDateString('es-AR')}` : 'Pagada'}
                    </p>
                    {f.payToken && (
                      <a href={`/pagar/${f.payToken}`} className="text-xs font-medium underline" style={{ color: 'var(--color-text-muted)' }}>
                        Ver comprobante
                      </a>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
