'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PaymentDetailsModal } from '@/components/invoices/payment-details-modal'
import { formatMoneyExact, formatDate } from '@/lib/utils'
import { medioPagoLabel, type PagoDetalle } from '@/lib/medios-pago'
import toast from 'react-hot-toast'

interface PagoRow {
  id: string; provider: string; metodo: string | null; status: string
  amount: number; currency: string; rawPayload: unknown; paidAt: string | null; createdAt: string
}
interface FacturaPagos {
  id: string; amount: number; currency: string; status: string; numeroInterno: string | null; description: string | null
  empresa: { id: string; name: string } | null; client: { id: string; name: string } | null
  payments: PagoRow[]; cobrado: number; saldo: number
}

const PROVIDER_LABEL: Record<string, string> = { WHOP: 'Whop', MERCADOPAGO: 'Mercado Pago' }

// Cobros de una factura (pagos parciales, pedido de Abba 2026-11): lista
// cada pago con su fecha/medio/monto, deja corregir o anular los manuales y
// registrar el siguiente mientras quede saldo.
export function PagosFacturaModal({ invoiceId, onClose, onChanged }: { invoiceId: string; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<PagoRow | null>(null)
  const [adding, setAdding] = useState(false)
  const [anulando, setAnulando] = useState<PagoRow | null>(null)
  const [busy, setBusy] = useState(false)

  const { data, isLoading } = useQuery<FacturaPagos>({
    queryKey: ['invoice-pagos', invoiceId],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${invoiceId}/pagos`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      return json.data
    },
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['invoice-pagos', invoiceId] })
    onChanged()
  }

  const anular = async (p: PagoRow) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/payments/${p.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error ?? 'No se pudo anular'); return }
      toast.success('Pago anulado — el saldo volvió a la factura')
      setAnulando(null)
      refresh()
    } finally { setBusy(false) }
  }

  const titulo = data ? `Pagos — Factura ${data.numeroInterno ?? `#${data.id.slice(-6).toUpperCase()}`}` : 'Pagos'
  const empresaName = data?.empresa?.name ?? data?.client?.name ?? null
  const puedeCobrar = !!data && data.saldo > 0 && data.status !== 'CANCELLED'

  return (
    <>
      <Modal open={!editing && !adding && !anulando} onClose={onClose} title={titulo} size="md">
        {isLoading || !data ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { l: 'Total', v: data.amount },
                { l: 'Pagado', v: data.cobrado },
                { l: 'Saldo', v: data.saldo },
              ].map((x) => (
                <div key={x.l} className="rounded-xl p-2" style={{ background: 'var(--color-surface-raised)' }}>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{x.l}</p>
                  <p className="text-sm font-bold" style={{ color: x.l === 'Saldo' && x.v > 0 ? '#d97706' : 'var(--color-text)' }}>{formatMoneyExact(x.v, data.currency)}</p>
                </div>
              ))}
            </div>

            {data.payments.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>Todavía no hay pagos registrados.</p>
            ) : (
              <div className="divide-y rounded-xl" style={{ border: '1px solid var(--color-border)', borderColor: 'var(--color-border)' }}>
                {data.payments.map((p) => {
                  const medio = p.provider === 'MANUAL' ? (medioPagoLabel(p.metodo) ?? 'Manual') : (PROVIDER_LABEL[p.provider] ?? p.provider)
                  const aprobado = p.status === 'APPROVED'
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                          {formatMoneyExact(p.amount, p.currency)} <span className="font-normal text-xs" style={{ color: 'var(--color-text-muted)' }}>· {medio}</span>
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{formatDate(p.paidAt ?? p.createdAt)}</p>
                      </div>
                      {!aprobado && <Badge size="sm" variant={p.status === 'REFUNDED' ? 'danger' : 'neutral'}>{p.status === 'REFUNDED' ? 'Reembolsado' : p.status === 'REJECTED' ? 'Rechazado' : 'Pendiente'}</Badge>}
                      {p.provider === 'MANUAL' && (
                        <div className="flex gap-1">
                          <button onClick={() => setEditing(p)} title="Corregir" className="p-1.5 rounded-lg hover:bg-[var(--color-surface-overlay)] text-[var(--color-text-subtle)] hover:text-[var(--color-primary)]"><Pencil size={14} /></button>
                          <button onClick={() => setAnulando(p)} title="Anular" className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-subtle)] hover:text-red-400"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <ModalFooter>
              <Button variant="ghost" onClick={onClose}>Cerrar</Button>
              {puedeCobrar && <Button leftIcon={<Plus size={14} />} onClick={() => setAdding(true)}>Registrar pago</Button>}
            </ModalFooter>
          </div>
        )}
      </Modal>

      {data && adding && (
        <PaymentDetailsModal
          open onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); refresh() }}
          invoiceId={data.id} amount={data.amount} currency={data.currency} saldo={data.saldo}
          empresaName={empresaName}
        />
      )}
      {data && editing && (
        <PaymentDetailsModal
          open onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh() }}
          invoiceId={data.id} amount={data.amount} currency={data.currency}
          empresaName={empresaName}
          paymentId={editing.id} initialMonto={editing.amount}
          initialMetodo={editing.metodo} initialDetalle={editing.rawPayload as PagoDetalle | null}
        />
      )}
      <Modal open={!!anulando} onClose={() => setAnulando(null)} title="Anular pago" size="sm">
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          ¿Anular el pago de <strong style={{ color: 'var(--color-text)' }}>{anulando && data ? formatMoneyExact(anulando.amount, data.currency) : ''}</strong>? Ese monto vuelve a quedar pendiente en la factura{data?.status === 'PAID' ? ' (y deja de figurar como pagada)' : ''}.
        </p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setAnulando(null)}>Cancelar</Button>
          <Button variant="danger" loading={busy} onClick={() => anulando && anular(anulando)}>Anular pago</Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
