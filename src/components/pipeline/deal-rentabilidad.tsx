'use client'

import { useQuery } from '@tanstack/react-query'
import { formatMoneyExact } from '@/lib/utils'

const money = (m: Record<string, number> | undefined) => {
  const e = Object.entries(m ?? {}).filter(([, v]) => Math.abs(v) > 0.01)
  return e.length ? e.map(([c, v]) => formatMoneyExact(v, c)).join(' · ') : '—'
}

export function DealRentabilidad({ dealId }: { dealId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['deal-rentabilidad', dealId],
    queryFn: async () => (await fetch(`/api/deals/${dealId}/rentabilidad`)).json(),
    staleTime: 10_000,
  })
  const r = data?.data
  if (isLoading) return <p className="text-xs py-2" style={{ color: 'var(--color-text-muted)' }}>Calculando...</p>
  if (!r) return null

  const ingresos = r.ingresos as Record<string, number>
  const curPrincipal = Object.keys(ingresos)[0] ?? r.moneda ?? 'USD'
  const ingresoPrincipal = ingresos[curPrincipal] ?? 0
  const costoMateriales = r.costoReal.materiales as number
  const costoComprasPrincipal = (r.costoReal.compras as Record<string, number>)[curPrincipal] ?? 0
  const costoRealTotal = costoMateriales + costoComprasPrincipal
  const margenReal = ingresoPrincipal - costoRealTotal
  const margenRealPct = ingresoPrincipal > 0 ? (margenReal / ingresoPrincipal) * 100 : 0
  const margenCotizado = ingresoPrincipal - (r.costoCotizado as number)
  const desvio = margenCotizado !== 0 ? ((margenReal - margenCotizado) / Math.abs(margenCotizado)) * 100 : 0

  return (
    <div className="space-y-2 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <Cell label={r.facturado ? 'Facturado' : 'Cotizaciones aceptadas'} value={money(ingresos)} />
        <Cell label="Costo real" value={money({ [curPrincipal]: costoRealTotal })} sub={`materiales ${formatMoneyExact(costoMateriales, curPrincipal)}${costoComprasPrincipal ? ` + compras ${formatMoneyExact(costoComprasPrincipal, curPrincipal)}` : ''}`} />
      </div>
      <div className="rounded-lg p-2.5" style={{ background: margenReal >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
        <div className="flex items-center justify-between">
          <span style={{ color: 'var(--color-text-muted)' }}>Margen real</span>
          <span className="font-bold text-sm" style={{ color: margenReal >= 0 ? '#10b981' : '#ef4444' }}>
            {formatMoneyExact(margenReal, curPrincipal)} ({margenRealPct.toFixed(0)}%)
          </span>
        </div>
        {r.costoCotizado > 0 && (
          <div className="flex items-center justify-between mt-1" style={{ color: 'var(--color-text-subtle)' }}>
            <span>vs. margen cotizado {formatMoneyExact(margenCotizado, curPrincipal)}</span>
            <span style={{ color: Math.abs(desvio) > 15 ? '#f59e0b' : 'var(--color-text-subtle)' }}>
              {desvio > 0 ? '+' : ''}{desvio.toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg p-2" style={{ background: 'var(--color-surface-raised)' }}>
      <p style={{ color: 'var(--color-text-subtle)' }}>{label}</p>
      <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{value}</p>
      {sub && <p className="text-[10px]" style={{ color: 'var(--color-text-subtle)' }}>{sub}</p>}
    </div>
  )
}
