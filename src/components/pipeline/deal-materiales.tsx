'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PackageCheck, ShoppingCart, ArrowUpRight } from 'lucide-react'
import { formatMoneyExact } from '@/lib/utils'

const EST_ENTREGA: Record<string, { label: string; color: string }> = {
  BORRADOR:  { label: 'Preparando', color: '#f59e0b' },
  ENTREGADA: { label: 'Entregada',  color: '#10b981' },
  ANULADA:   { label: 'Anulada',    color: '#ef4444' },
}
const EST_COMPRA: Record<string, { label: string; color: string }> = {
  BORRADOR:  { label: 'Borrador',   color: '#f59e0b' },
  CONFIRMADA: { label: 'Confirmada', color: '#10b981' },
  ANULADA:   { label: 'Anulada',    color: '#ef4444' },
}

export function DealMateriales({ dealId }: { dealId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['deal-materiales', dealId],
    queryFn: async () => (await fetch(`/api/deals/${dealId}/materiales`)).json(),
    staleTime: 10_000,
  })
  const m = data?.data

  if (isLoading) return <p className="text-xs py-3" style={{ color: 'var(--color-text-muted)' }}>Cargando materiales...</p>
  if (!m || (m.entregas.length === 0 && m.compras.length === 0)) {
    return (
      <p className="text-xs py-2" style={{ color: 'var(--color-text-subtle)' }}>
        Sin entregas de stock ni compras imputadas a esta obra todavía.
      </p>
    )
  }

  const comprasStr = Object.entries(m.resumen.comprasPorMoneda as Record<string, number>)
    .map(([cur, val]) => formatMoneyExact(val as number, cur)).join(' · ')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs">
        {m.resumen.costoEntregado > 0 && (
          <span className="px-2 py-1 rounded-lg" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text)' }}>
            Material entregado (costo): <strong>{formatMoneyExact(m.resumen.costoEntregado, 'USD')}</strong>
          </span>
        )}
        {comprasStr && (
          <span className="px-2 py-1 rounded-lg" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text)' }}>
            Compras imputadas: <strong>{comprasStr}</strong>
          </span>
        )}
      </div>

      {m.entregas.length > 0 && (
        <div className="space-y-1">
          {m.entregas.map((e: any) => {
            const st = EST_ENTREGA[e.estado] ?? EST_ENTREGA.BORRADOR
            return (
              <Link key={e.id} href={`/entregas?id=${e.id}`}
                className="flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5 hover:bg-[var(--color-surface-raised)]">
                <span className="flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                  <PackageCheck size={12} style={{ color: st.color }} />
                  {e.numero ? `Remito #${e.numero}` : 'Remito (borrador)'} · {e.unidades} u.
                </span>
                <span className="flex items-center gap-1" style={{ color: st.color }}>{st.label} <ArrowUpRight size={11} /></span>
              </Link>
            )
          })}
        </div>
      )}

      {m.compras.length > 0 && (
        <div className="space-y-1">
          {m.compras.map((c: any) => {
            const st = EST_COMPRA[c.estado] ?? EST_COMPRA.BORRADOR
            return (
              <Link key={c.id} href="/compras"
                className="flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5 hover:bg-[var(--color-surface-raised)]">
                <span className="flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                  <ShoppingCart size={12} style={{ color: st.color }} />
                  {c.proveedor?.name ?? 'Compra'} · {formatMoneyExact(c.total, c.moneda)}
                </span>
                <span style={{ color: st.color }}>{st.label}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
