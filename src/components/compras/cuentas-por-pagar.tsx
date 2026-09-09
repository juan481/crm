'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Wallet } from 'lucide-react'
import { formatMoneyExact } from '@/lib/utils'
import { CompraDetail } from '@/components/compras/compra-detail'
import { Modal } from '@/components/ui/modal'

const money = (m: Record<string, number>) => {
  const e = Object.entries(m ?? {}).filter(([, v]) => v > 0.01)
  return e.length ? e.map(([c, v]) => formatMoneyExact(v, c)).join(' · ') : '—'
}

export function CuentasPorPagar({ onChanged }: { onChanged: () => void }) {
  const [detailId, setDetailId] = useState<string | null>(null)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['compras-por-pagar'],
    queryFn: async () => (await fetch('/api/compras/por-pagar')).json(),
    staleTime: 15_000,
  })

  const rows = data?.data ?? []
  const totalPorMoneda: Record<string, number> = data?.totalPorMoneda ?? {}
  const aging: Record<string, { d0_30: number; d30_60: number; d60: number; sinVenc: number }> = data?.aging ?? {}

  const agingTotals = Object.values(aging).reduce(
    (acc, a) => ({ d0_30: acc.d0_30 + a.d0_30, d30_60: acc.d30_60 + a.d30_60, d60: acc.d60 + a.d60, sinVenc: acc.sinVenc + a.sinVenc }),
    { d0_30: 0, d30_60: 0, d60: 0, sinVenc: 0 },
  )
  const curPrincipal = Object.keys(totalPorMoneda)[0] ?? 'ARS'

  const refetchAll = () => { refetch(); onChanged() }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="Total por pagar" value={money(totalPorMoneda)} strong />
        <Card label="Vence en 0-30 d" value={formatMoneyExact(agingTotals.d0_30, curPrincipal)} />
        <Card label="Vencido 30-60 d" value={formatMoneyExact(agingTotals.d30_60, curPrincipal)} tone={agingTotals.d30_60 > 0 ? 'warn' : undefined} />
        <Card label="Vencido +60 d" value={formatMoneyExact(agingTotals.d60, curPrincipal)} tone={agingTotals.d60 > 0 ? 'danger' : undefined} />
      </div>

      <div className="rounded-2xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Proveedor</th>
              <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>Vence</th>
              <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Total</th>
              <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center" style={{ color: 'var(--color-text-muted)' }}>Cargando...</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-14 text-center">
                  <Wallet size={30} className="mx-auto mb-3 opacity-25" />
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>No hay nada por pagar</p>
                </td>
              </tr>
            ) : rows.map((c: any) => (
              <tr key={c.id} onClick={() => setDetailId(c.id)}
                className="cursor-pointer transition-colors hover:bg-[var(--color-surface-raised)]" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td className="px-4 py-3">
                  <div className="font-medium" style={{ color: 'var(--color-text)' }}>{c.proveedor?.name ?? 'Sin proveedor'}</div>
                  <div className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
                    {c.numeroComprobante || (c.numero ? `#${c.numero}` : '')} · {c.estadoPago === 'PARCIAL' ? 'pago parcial' : 'sin pagar'}
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-xs" style={{ color: c.vencido ? '#ef4444' : 'var(--color-text-muted)' }}>
                  {c.vencimiento ? new Date(c.vencimiento).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : 'sin fecha'}
                  {c.vencido ? ' ⚠' : ''}
                </td>
                <td className="px-4 py-3 text-right" style={{ color: 'var(--color-text-muted)' }}>{formatMoneyExact(c.total, c.moneda)}</td>
                <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text)' }}>
                  {formatMoneyExact(c.saldo, c.moneda)} <span className="text-[10px] font-normal" style={{ color: 'var(--color-text-subtle)' }}>{c.moneda}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!detailId} onClose={() => setDetailId(null)} title="Compra" size="lg">
        {detailId && <CompraDetail compraId={detailId} onChanged={refetchAll} />}
      </Modal>
    </div>
  )
}

function Card({ label, value, tone, strong }: { label: string; value: string; tone?: 'warn' | 'danger'; strong?: boolean }) {
  const color = tone === 'danger' ? '#ef4444' : tone === 'warn' ? '#f59e0b' : 'var(--color-text)'
  return (
    <div className="surface rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
        {tone === 'danger' && <AlertTriangle size={13} />} {label}
      </div>
      <p className={`${strong ? 'text-xl' : 'text-base'} font-bold mt-1.5 truncate`} style={{ color }} title={value}>{value}</p>
    </div>
  )
}
