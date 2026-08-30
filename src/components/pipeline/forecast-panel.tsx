'use client'

// Forecast "a prueba de boludos" — una tira de meses arriba del Kanban que
// responde una sola pregunta: ¿cuánto esperás facturar cada mes? No tiene
// controles ni configuración. Se calcula 100% en el cliente a partir de los
// mismos deals que ya trae la página de Pipeline (sin endpoint nuevo).
//
// Por mes se muestra:
//   - GANADO: deals cerrados ganados con closedAt en ese mes (plata firme).
//   - Ponderado: Σ (monto × probabilidad) de los deals abiertos cuya fecha
//     estimada de cierre cae en ese mes.
// Las oportunidades sin fecha de cierre no entran al gráfico — se listan
// aparte con un empujón para que les pongan fecha.

import { useMemo } from 'react'
import { addMonths, startOfMonth, endOfMonth, isWithinInterval, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { TrendingUp, CalendarClock, CircleAlert } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Deal } from '@/types'

const MONTHS_AHEAD = 6
const OPEN_STAGES = new Set(['LEAD', 'CONTACTADO', 'PROPUESTA', 'NEGOCIACION'])

interface Bucket {
  date: Date
  ganado: number
  ponderado: number
  count: number
  atrasadas: number
}

export function ForecastPanel({ deals }: { deals: Deal[] }) {
  const model = useMemo(() => {
    // Moneda principal = la de mayor monto acumulado (deals no perdidos).
    const byCur: Record<string, number> = {}
    for (const d of deals) if (d.stage !== 'PERDIDO') byCur[d.currency] = (byCur[d.currency] ?? 0) + d.amount
    const sorted = Object.entries(byCur).sort((a, b) => b[1] - a[1])
    const currency = sorted[0]?.[0] ?? 'ARS'
    const otherCurrencies = sorted.slice(1).map(([c]) => c)

    const firstMonth = startOfMonth(new Date())
    const buckets: Bucket[] = Array.from({ length: MONTHS_AHEAD }, (_, i) => ({
      date: addMonths(firstMonth, i), ganado: 0, ponderado: 0, count: 0, atrasadas: 0,
    }))
    const lastMonthEnd = endOfMonth(buckets[buckets.length - 1].date)

    let sinFecha = 0
    let sinFechaCount = 0

    for (const d of deals) {
      if (d.currency !== currency) continue

      if (d.stage === 'GANADO') {
        if (!d.closedAt) continue
        const cd = new Date(d.closedAt)
        const b = buckets.find((b) => isWithinInterval(cd, { start: b.date, end: endOfMonth(b.date) }))
        if (b) { b.ganado += d.amount; b.count++ }
        continue
      }
      if (!OPEN_STAGES.has(d.stage)) continue // PERDIDO u otro

      const weighted = d.amount * (d.probability / 100)
      if (weighted <= 0) continue

      if (!d.expectedCloseDate) { sinFecha += weighted; sinFechaCount++; continue }

      const ed = new Date(d.expectedCloseDate)
      if (ed < buckets[0].date) {
        // Atrasada: la fecha estimada ya pasó → se cuenta en el mes actual.
        buckets[0].ponderado += weighted
        buckets[0].count++
        buckets[0].atrasadas++
      } else if (ed <= lastMonthEnd) {
        const b = buckets.find((b) => isWithinInterval(ed, { start: b.date, end: endOfMonth(b.date) }))!
        b.ponderado += weighted
        b.count++
      }
      // fecha más allá del horizonte → fuera de la tira, no se pierde el deal
    }

    const totalPonderado = buckets.reduce((s, b) => s + b.ganado + b.ponderado, 0)
    const totalGanado = buckets.reduce((s, b) => s + b.ganado, 0)
    const max = Math.max(1, ...buckets.map((b) => b.ganado + b.ponderado))

    return { currency, otherCurrencies, buckets, totalPonderado, totalGanado, max, sinFecha, sinFechaCount }
  }, [deals])

  const { currency, buckets, totalPonderado, totalGanado, max, sinFecha, sinFechaCount, otherCurrencies } = model
  const nothingToShow = totalPonderado === 0 && sinFecha === 0

  return (
    <div
      className="rounded-2xl p-4 sm:p-5"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp size={16} style={{ color: 'var(--color-primary)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
              Proyección de facturación
            </h2>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Próximos {MONTHS_AHEAD} meses · ganado firme + oportunidades abiertas ponderadas por probabilidad
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total proyectado</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
            {formatCurrency(totalPonderado, currency)}
          </p>
          {totalGanado > 0 && (
            <p className="text-[11px]" style={{ color: '#10b981' }}>
              {formatCurrency(totalGanado, currency)} ya ganado
            </p>
          )}
        </div>
      </div>

      {nothingToShow ? (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
          Todavía no hay oportunidades con monto y fecha de cierre para proyectar.
          Cargá el monto y la fecha estimada en cada oportunidad del Pipeline.
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {buckets.map((b, i) => {
            const total = b.ganado + b.ponderado
            const pct = Math.round((total / max) * 100)
            const ganPct = total > 0 ? Math.round((b.ganado / total) * 100) : 0
            const isCurrent = i === 0
            return (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div
                  className="w-full rounded-lg flex flex-col justify-end overflow-hidden"
                  style={{
                    height: 96,
                    background: 'var(--color-surface-raised)',
                    border: isCurrent ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  }}
                  title={`${formatCurrency(total, currency)}${b.ganado ? ` · ${formatCurrency(b.ganado, currency)} ganado` : ''}`}
                >
                  <div style={{ height: `${pct}%`, display: 'flex', flexDirection: 'column' }}>
                    {b.ganado > 0 && <div style={{ height: `${ganPct}%`, background: '#10b981' }} />}
                    <div style={{ flex: 1, background: 'var(--color-primary)', opacity: 0.55 }} />
                  </div>
                </div>
                <span className="text-[11px] font-medium capitalize" style={{ color: isCurrent ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                  {format(b.date, 'LLL', { locale: es })}
                </span>
                <span className="text-[11px] font-semibold text-center leading-tight" style={{ color: 'var(--color-text)' }}>
                  {total > 0 ? formatCurrency(total, currency) : '—'}
                </span>
                {b.atrasadas > 0 && (
                  <span className="text-[10px] flex items-center gap-0.5 text-amber-400" title="Oportunidades cuya fecha estimada ya pasó">
                    <CircleAlert size={9} />{b.atrasadas} atrasada{b.atrasadas > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {sinFecha > 0 && (
        <div
          className="mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
          style={{ background: 'var(--color-surface-raised)', border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)' }}
        >
          <CalendarClock size={13} className="shrink-0 mt-0.5" style={{ color: 'var(--color-text-subtle)' }} />
          <span>
            <strong style={{ color: 'var(--color-text)' }}>{formatCurrency(sinFecha, currency)}</strong> ponderado
            en <strong style={{ color: 'var(--color-text)' }}>{sinFechaCount}</strong>{' '}
            {sinFechaCount === 1 ? 'oportunidad sin fecha' : 'oportunidades sin fecha'} de cierre —
            abrí cada una y poné la fecha estimada para verlas proyectadas acá.
          </span>
        </div>
      )}

      {otherCurrencies.length > 0 && (
        <p className="mt-2 text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
          La proyección muestra sólo {currency}. Hay oportunidades también en {otherCurrencies.join(', ')} (no sumadas acá).
        </p>
      )}
    </div>
  )
}
