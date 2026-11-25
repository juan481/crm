'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Wallet, CalendarClock } from 'lucide-react'
import { formatMoneyExact } from '@/lib/utils'
import { fmtDia, diasEntre } from '@/lib/compras-pagos'
import { CompraDetail } from '@/components/compras/compra-detail'
import { Modal } from '@/components/ui/modal'

const money = (m: Record<string, number> | undefined) => {
  const e = Object.entries(m ?? {}).filter(([, v]) => v > 0.01)
  return e.length ? e.map(([c, v]) => formatMoneyExact(v, c)).join(' · ') : '$ 0'
}
const suma = (...ms: (Record<string, number> | undefined)[]) => {
  const out: Record<string, number> = {}
  for (const m of ms) for (const [k, v] of Object.entries(m ?? {})) out[k] = (out[k] ?? 0) + v
  return out
}

export function CuentasPorPagar({ onChanged }: { onChanged: () => void }) {
  const [detailId, setDetailId] = useState<string | null>(null)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['compras-por-pagar'],
    queryFn: async () => (await fetch('/api/compras/por-pagar')).json(),
    staleTime: 15_000,
  })

  const facturas: any[] = data?.data ?? []
  const aDebitar: any[] = data?.aDebitar ?? []
  const tot = data?.totales ?? {}
  const hoy: string = data?.hoy ?? new Date().toISOString().slice(0, 10)
  const hayVencido = Object.values(tot.vencido ?? {}).some((v: any) => v > 0.01)

  const refetchAll = () => { refetch(); onChanged() }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="Total comprometido" hint="Facturas sin pagar + cheques a debitar" value={money(suma(tot.sinPagar, tot.aDebitar))} strong />
        <Card label="Facturas sin pagar" hint={hayVencido ? `Vencido: ${money(tot.vencido)}` : 'Sin cheque ni pago cargado'} value={money(tot.sinPagar)} tone={hayVencido ? 'danger' : undefined} />
        <Card label="Cheques a debitar" hint="Ya entregados, la plata sale en su fecha" value={money(tot.aDebitar)} />
        <Card label="Sale en los próximos 30 días" hint="Cheques + facturas que vencen" value={money(tot.prox30)} tone={Object.keys(tot.prox30 ?? {}).length ? 'warn' : undefined} />
      </div>

      {/* Facturas con saldo sin cubrir */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-subtle)' }}>Facturas sin pagar</h3>
        <div className="rounded-2xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Proveedor</th>
                <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>Vence</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Total</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Falta pagar</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center" style={{ color: 'var(--color-text-muted)' }}>Cargando...</td></tr>
              ) : facturas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center">
                    <Wallet size={26} className="mx-auto mb-2 opacity-25" />
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No hay facturas sin pagar</p>
                  </td>
                </tr>
              ) : facturas.map((c: any) => (
                <tr key={c.id} onClick={() => setDetailId(c.id)}
                  className="cursor-pointer transition-colors hover:bg-[var(--color-surface-raised)]" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: 'var(--color-text)' }}>{c.proveedor?.name ?? 'Sin proveedor'}</div>
                    <div className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
                      {c.comprobante} · {c.estadoPago === 'PARCIAL' ? `pagado ${formatMoneyExact(c.pagado, c.moneda)}` : 'sin pagar'}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-xs" style={{ color: c.vencido ? '#ef4444' : 'var(--color-text-muted)' }}>
                    {c.vencimiento ? fmtDia(c.vencimiento, { day: '2-digit', month: 'short' }) : 'sin fecha'}
                    {c.vencido ? ' ⚠ vencida' : ''}
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
      </section>

      {/* Cheques diferidos / pagos programados */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-subtle)' }}>Cheques y pagos a debitar</h3>
        <div className="rounded-2xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Fecha de débito</th>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Proveedor</th>
                <th className="px-4 py-3 text-left font-semibold hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>Medio</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center" style={{ color: 'var(--color-text-muted)' }}>Cargando...</td></tr>
              ) : aDebitar.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center">
                    <CalendarClock size={26} className="mx-auto mb-2 opacity-25" />
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No hay cheques ni pagos con fecha a futuro</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>Al registrar un pago con fecha posterior a hoy aparece acá hasta que se debita.</p>
                  </td>
                </tr>
              ) : aDebitar.map((p: any) => {
                const dias = diasEntre(hoy, p.dia)
                return (
                  <tr key={p.id} onClick={() => setDetailId(p.compraId)}
                    className="cursor-pointer transition-colors hover:bg-[var(--color-surface-raised)]" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: 'var(--color-text)' }}>{fmtDia(p.fecha, { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      <div className="text-[11px]" style={{ color: dias <= 7 ? '#f59e0b' : 'var(--color-text-subtle)' }}>
                        {dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div style={{ color: 'var(--color-text)' }}>{p.proveedor?.name ?? 'Sin proveedor'}</div>
                      <div className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>{p.comprobante}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {p.medio ?? '—'}{p.nota ? <span style={{ color: 'var(--color-text-subtle)' }}> · {p.nota}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text)' }}>
                      {formatMoneyExact(p.monto, p.moneda)} <span className="text-[10px] font-normal" style={{ color: 'var(--color-text-subtle)' }}>{p.moneda}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={!!detailId} onClose={() => setDetailId(null)} title="Compra" size="lg">
        {detailId && <CompraDetail compraId={detailId} onChanged={refetchAll} />}
      </Modal>
    </div>
  )
}

function Card({ label, value, hint, tone, strong }: { label: string; value: string; hint?: string; tone?: 'warn' | 'danger'; strong?: boolean }) {
  const color = tone === 'danger' ? '#ef4444' : tone === 'warn' ? '#f59e0b' : 'var(--color-text)'
  return (
    <div className="surface rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
        {tone === 'danger' && <AlertTriangle size={13} />} {label}
      </div>
      <p className={`${strong ? 'text-xl' : 'text-base'} font-bold mt-1.5 truncate`} style={{ color }} title={value}>{value}</p>
      {hint && <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--color-text-subtle)' }} title={hint}>{hint}</p>}
    </div>
  )
}
