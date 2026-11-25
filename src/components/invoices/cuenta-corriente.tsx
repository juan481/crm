'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMoneyExact, formatDate } from '@/lib/utils'

interface Movimiento {
  id: string; fecha: string; tipo: 'FACTURA' | 'PAGO'; concepto: string; invoiceId: string
  currency: string; debe: number; haber: number; saldo: number
}
interface CuentaCorrienteData {
  empresa: { id: string; name: string }
  movimientos: Movimiento[]
  saldoPorMoneda: Record<string, number>
}
interface SaldoCliente {
  empresaId: string; nombre: string; saldoPorMoneda: Record<string, number>
  facturas: number; vencidas: number; conPagoParcial: number
}

function SaldoLines({ byCurrency, className }: { byCurrency: Record<string, number>; className?: string }) {
  const entries = Object.entries(byCurrency).filter(([, v]) => Math.abs(v) > 0.004)
  if (entries.length === 0) return <span className={className} style={{ color: '#16a34a' }}>Al día</span>
  return (
    <span className={className}>
      {entries.map(([cur, v]) => (
        <span key={cur} className="block" style={{ color: v > 0 ? '#d97706' : '#16a34a' }}>
          {formatMoneyExact(Math.abs(v), cur)}{v < 0 ? ' a favor' : ''}
        </span>
      ))}
    </span>
  )
}

// Cuenta corriente de UN cliente (pedido de Abba, 2026-11): facturas al
// debe, pagos al haber, saldo acumulado por moneda. Ver /api/cuenta-corriente.
export function CuentaCorrienteModal({ empresaId, onClose }: { empresaId: string; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery<CuentaCorrienteData>({
    queryKey: ['cuenta-corriente', empresaId],
    queryFn: async () => {
      const res = await fetch(`/api/cuenta-corriente?empresaId=${empresaId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      return json.data
    },
    staleTime: 0,
  })

  return (
    <Modal open onClose={onClose} title={data ? `Cuenta corriente — ${data.empresa.name}` : 'Cuenta corriente'} size="lg">
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}</div>
      ) : isError || !data ? (
        <p className="text-sm" style={{ color: '#ef4444' }}>No se pudo cargar la cuenta corriente.</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl p-3 flex items-center justify-between gap-3" style={{ background: 'var(--color-surface-raised)' }}>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Saldo actual</span>
            <SaldoLines byCurrency={data.saldoPorMoneda} className="text-lg font-bold text-right" />
          </div>
          {data.movimientos.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>Este cliente no tiene facturas todavía.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--color-border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                    <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                    <th className="px-3 py-2 text-left font-semibold">Concepto</th>
                    <th className="px-3 py-2 text-right font-semibold">Debe</th>
                    <th className="px-3 py-2 text-right font-semibold">Haber</th>
                    <th className="px-3 py-2 text-right font-semibold">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.movimientos.map((m) => (
                    <tr key={m.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>{formatDate(m.fecha)}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text)' }}>{m.concepto}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: 'var(--color-text)' }}>{m.debe ? formatMoneyExact(m.debe, m.currency) : ''}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: '#16a34a' }}>{m.haber ? formatMoneyExact(m.haber, m.currency) : ''}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap font-medium" style={{ color: 'var(--color-text)' }}>{formatMoneyExact(m.saldo, m.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
            Los pagos parciales se cargan desde Facturación → “Registrar pago” en la factura, poniendo un monto menor al saldo.
          </p>
        </div>
      )}
    </Modal>
  )
}

// Todos los clientes que hoy deben algo (facturas pendientes/vencidas menos
// lo que ya pagaron a cuenta). Click en uno → su cuenta corriente.
export function CuentasCorrientesModal({ onClose }: { onClose: () => void }) {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const { data, isLoading } = useQuery<SaldoCliente[]>({
    queryKey: ['cuentas-corrientes'],
    queryFn: async () => {
      const res = await fetch('/api/cuenta-corriente')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      return json.data
    },
    staleTime: 0,
  })

  if (empresaId) return <CuentaCorrienteModal empresaId={empresaId} onClose={() => setEmpresaId(null)} />

  return (
    <Modal open onClose={onClose} title="Cuentas corrientes" size="md">
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Ningún cliente tiene saldo pendiente.</p>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {data.map((c) => (
            <button
              key={c.empresaId}
              onClick={() => setEmpresaId(c.empresaId)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 transition-all text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{c.nombre}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {c.facturas} factura{c.facturas !== 1 ? 's' : ''} con saldo
                  {c.conPagoParcial > 0 && ` · ${c.conPagoParcial} con pago parcial`}
                  {c.vencidas > 0 && <span style={{ color: '#ef4444' }}> · {c.vencidas} vencida{c.vencidas !== 1 ? 's' : ''}</span>}
                </p>
              </div>
              <SaldoLines byCurrency={c.saldoPorMoneda} className="text-sm font-bold text-right" />
              <ChevronRight size={16} className="text-[var(--color-text-subtle)] shrink-0" />
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}
