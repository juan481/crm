'use client'

// Panel de comisiones — reestructuración Abba 2026-10. Utilidad acumulada
// del mes (de ventas ya PAGADAS, ver CommissionLedger) × tramo según cuánto
// del objetivo de venta lleva cumplido cada vendedor (10/15/20%, siempre
// sobre el TOTAL del mes, nunca marginal — confirmado por Seba). Mismo
// criterio de mes-calendario que ObjetivosPanel, con su propia navegación
// (no comparten estado — ver ese componente para el mismo patrón).

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Percent } from 'lucide-react'
import { formatMoneyExact } from '@/lib/utils'
import { argentinaDayKey } from '@/lib/timezone'

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}
function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
// Argentina-aware (no el reloj local del navegador de quien mira el panel) —
// tiene que coincidir con el mes que usa CommissionLedger al escribir (ver
// src/lib/commissions.ts), o una venta recién pagada parece "faltar" hasta
// que se pagina el mes a mano.
const currentMonth = () => argentinaDayKey().slice(0, 7)

interface CommissionBreakdown { currency: string; ganancia: number; utilidad: number; comision: number }
interface CommissionRow {
  userId: string; name: string
  realVendido: number; objetivo: number; pctObjetivo: number
  tierPct: number; breakdown: CommissionBreakdown[]
}

function TierBadge({ pct }: { pct: number }) {
  const color = pct >= 20 ? '#10b981' : pct >= 15 ? 'var(--color-primary)' : 'var(--color-text-muted)'
  return (
    <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${color}1A`, color }}>
      {pct}%
    </span>
  )
}

// Casi siempre una sola moneda (las facturas de Abba salen en ARS) — pero
// si hay más de una en el mes, se muestran separadas en vez de sumarlas
// (bug real: sumar ARS + USD daba un número sin sentido).
function Row({ row }: { row: CommissionRow }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-24 shrink-0 text-sm font-medium truncate" style={{ color: 'var(--color-text)' }} title={row.name}>{row.name}</span>
      <span className="flex-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {row.breakdown.length
          ? row.breakdown.map(b => `Utilidad ${formatMoneyExact(b.utilidad, b.currency)}`).join(' + ')
          : 'Sin utilidad este mes'}
        {' · '}{row.pctObjetivo.toFixed(0)}% del objetivo
      </span>
      <TierBadge pct={row.tierPct} />
      <span className="w-32 shrink-0 text-right text-sm font-bold" style={{ color: 'var(--color-text)' }}>
        {row.breakdown.length
          ? row.breakdown.map(b => formatMoneyExact(b.comision, b.currency)).join(' + ')
          : '—'}
      </span>
    </div>
  )
}

export function ComisionesPanel({ isAdmin }: { isAdmin: boolean }) {
  const [month, setMonth] = useState(currentMonth())

  const { data, isLoading } = useQuery<{ data: CommissionRow | CommissionRow[] }>({
    queryKey: ['commissions', month, isAdmin],
    queryFn: async () => {
      const params = new URLSearchParams({ month, ...(isAdmin ? { all: '1' } : {}) })
      const res = await fetch(`/api/commissions?${params}`)
      if (!res.ok) return { data: isAdmin ? [] : null as any }
      return res.json()
    },
    staleTime: 30_000,
  })

  const rows: CommissionRow[] = isAdmin
    ? ((data?.data as CommissionRow[]) ?? [])
    : (data?.data ? [data.data as CommissionRow] : [])

  // Nadie tiene todavía ganancia configurada (margen por familia / utilidad
  // real en 0) — no hay nada útil para mostrar, no vale la pena ocupar
  // espacio con un panel en cero para todos.
  if (!isLoading && rows.every(r => r.breakdown.length === 0) && !isAdmin) return null

  return (
    <div className="rounded-2xl p-4 sm:p-5 space-y-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Percent size={16} style={{ color: 'var(--color-primary)' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Comisiones</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="p-1 rounded hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium capitalize w-32 text-center" style={{ color: 'var(--color-text)' }}>{monthLabel(month)}</span>
          <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="p-1 rounded hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-muted)' }}>Sin datos de comisión para este mes.</p>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {rows.map((r) => <Row key={r.userId} row={r} />)}
        </div>
      )}
    </div>
  )
}
