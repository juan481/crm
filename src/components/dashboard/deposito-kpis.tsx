'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Warehouse, TrendingDown, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { formatMoneyExact } from '@/lib/utils'

const money = (m: Record<string, number> | undefined) => {
  const e = Object.entries(m ?? {}).filter(([, v]) => v > 0)
  return e.length ? e.map(([c, v]) => formatMoneyExact(v, c)).join(' · ') : '—'
}

export function DepositoKpis() {
  const { data } = useQuery({
    queryKey: ['dashboard-deposito'],
    queryFn: async () => (await fetch('/api/dashboard/deposito')).json(),
    staleTime: 2 * 60 * 1000,
  })
  const d = data?.data
  if (!d || d.visible === false) return null

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-subtle)' }}>Depósito</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi href="/stock" icon={<Warehouse size={14} />} label="Stock a costo" value={money(d.valorInventario)} />
        <Kpi href="/stock" icon={<TrendingDown size={14} />} label="Alertas de costo" value={String(d.alertasPendientes ?? 0)}
          tone={d.alertasPendientes > 0 ? 'warn' : undefined} />
        <Kpi href="/compras" icon={<ArrowUpCircle size={14} />} label="Por pagar" value={money(d.porPagar)}
          tone={Object.keys(d.porPagar ?? {}).length ? 'danger' : undefined} />
        <Kpi href="/facturas" icon={<ArrowDownCircle size={14} />} label="Por cobrar" value={money(d.porCobrar)} />
      </div>
    </div>
  )
}

function Kpi({ href, icon, label, value, tone }: { href: string; icon: React.ReactNode; label: string; value: string; tone?: 'warn' | 'danger' }) {
  const color = tone === 'danger' ? '#ef4444' : tone === 'warn' ? '#f59e0b' : 'var(--color-text)'
  return (
    <Link href={href} className="surface rounded-2xl p-4 block transition-colors hover:border-[var(--color-primary)]" style={{ border: '1px solid var(--color-border)' }}>
      <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>{icon} {label}</div>
      <p className="text-lg font-bold mt-1.5 truncate" style={{ color }} title={value}>{value}</p>
    </Link>
  )
}
