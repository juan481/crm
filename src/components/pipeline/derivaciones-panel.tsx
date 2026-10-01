'use client'

// "¿A quién le derivé qué?" — pedido de Abba (Seba, 2026-10-01): ver de un
// vistazo cuántas propuestas/leads tiene asignado cada vendedor/técnico
// (Emi, Kevin, Camila, Mauro, Oscar...) sin entrar deal por deal. Mismo
// criterio que ForecastPanel: 100% cliente, a partir de los deals que ya
// trae la página de Pipeline — sin endpoint nuevo.

import { useMemo } from 'react'
import { Users } from 'lucide-react'
import type { Deal } from '@/types'

const STAGE_META: Record<string, { label: string; color: string }> = {
  LEAD:        { label: 'Lead',        color: '#64748b' },
  CONTACTADO:  { label: 'Contactado',  color: '#3b82f6' },
  PROPUESTA:   { label: 'Propuesta',   color: '#6366f1' },
  NEGOCIACION: { label: 'Negociación', color: '#eab308' },
}
const OPEN_STAGES = Object.keys(STAGE_META)

interface OwnerRow {
  name: string
  porStage: Record<string, number>
  total: number
  ganados: number
}

export function DerivacionesPanel({ deals }: { deals: Deal[] }) {
  const rows = useMemo<OwnerRow[]>(() => {
    const byOwner = new Map<string, OwnerRow>()
    for (const d of deals) {
      const name = d.owner?.name ?? 'Sin asignar'
      if (!byOwner.has(name)) byOwner.set(name, { name, porStage: {}, total: 0, ganados: 0 })
      const row = byOwner.get(name)!
      if (d.stage === 'GANADO') { row.ganados++; continue }
      if (d.stage === 'PERDIDO') continue
      row.porStage[d.stage] = (row.porStage[d.stage] ?? 0) + 1
      row.total++
    }
    return Array.from(byOwner.values())
      .filter((r) => r.total > 0 || r.ganados > 0)
      .sort((a, b) => b.total - a.total)
  }, [deals])

  const max = Math.max(1, ...rows.map((r) => r.total))

  if (rows.length === 0) return null

  return (
    <div
      className="rounded-2xl p-4 sm:p-5 space-y-4"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center gap-2">
        <Users size={16} style={{ color: 'var(--color-primary)' }} />
        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
          Derivaciones por persona
        </h2>
      </div>
      <p className="text-xs -mt-2" style={{ color: 'var(--color-text-muted)' }}>
        Oportunidades abiertas asignadas a cada uno, por etapa — no cuenta ganadas ni perdidas.
      </p>

      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-sm font-medium truncate" style={{ color: 'var(--color-text)' }} title={r.name}>
              {r.name}
            </span>
            <div className="flex-1 h-5 rounded-full overflow-hidden flex" style={{ background: 'var(--color-surface-raised)' }}>
              {OPEN_STAGES.map((stage) => {
                const n = r.porStage[stage] ?? 0
                if (n === 0) return null
                const pct = (n / max) * 100
                return (
                  <div
                    key={stage}
                    style={{ width: `${pct}%`, background: STAGE_META[stage].color }}
                    title={`${STAGE_META[stage].label}: ${n}`}
                  />
                )
              })}
            </div>
            <span className="w-8 shrink-0 text-right text-sm font-bold" style={{ color: 'var(--color-text)' }}>
              {r.total}
            </span>
            {r.ganados > 0 && (
              <span className="w-20 shrink-0 text-right text-[11px]" style={{ color: '#10b981' }}>
                {r.ganados} ganada{r.ganados > 1 ? 's' : ''}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 pt-1 text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
        {OPEN_STAGES.map((stage) => (
          <span key={stage} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: STAGE_META[stage].color }} />
            {STAGE_META[stage].label}
          </span>
        ))}
      </div>
    </div>
  )
}
