'use client'

// Panel "Recurrentes" arriba del Kanban — pedido de Abba: quieren ver de un
// vistazo cuánto ingreso recurrente (abonos/mensualidades) ya está firmado,
// sin tener que ir a la pantalla de Servicios aparte. Reutiliza el mismo
// endpoint agrupado que /servicios (nombre+moneda), no duplica lógica de MRR.

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { RefreshCw, Users } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'

interface Grupo { nombre: string; moneda: string; clientes: number; mrr: number; min: number; max: number; ciclo: string }
interface Resp { agrupado: Grupo[]; kpis: { mrrPorMoneda: Record<string, number> } }

function money(byCur: Record<string, number>): string {
  const e = Object.entries(byCur).filter(([, v]) => v > 0.005)
  if (e.length === 0) return formatCurrency(0)
  return e.map(([c, v]) => formatCurrency(v, c)).join('  +  ')
}

export function RecurrentesPanel() {
  const { user } = useAuthStore()
  const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')

  const { data, isLoading } = useQuery<Resp>({
    queryKey: ['servicios-recurrentes', 'panel-pipeline'],
    queryFn: async () => {
      const r = await fetch('/api/servicios-recurrentes?estado=ACTIVO')
      if (!r.ok) throw new Error()
      return r.json()
    },
    enabled: !!isAdmin,
    staleTime: 60_000,
  })

  if (!isAdmin) return null
  if (isLoading) return null
  const agrupado = data?.agrupado ?? []
  if (agrupado.length === 0) return null

  return (
    <div
      className="rounded-2xl p-4 sm:p-5"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <RefreshCw size={16} style={{ color: 'var(--color-primary)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Recurrentes (abonos activos)</h2>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Ingreso ya firmado, más allá de lo que se mueva acá abajo en el Pipeline.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>MRR total</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{money(data?.kpis.mrrPorMoneda ?? {})}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {agrupado.map((g) => (
          <div key={`${g.nombre}::${g.moneda}`} className="rounded-xl p-3" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{g.nombre}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                <Users size={11} /> {g.clientes} cliente{g.clientes !== 1 ? 's' : ''}
              </span>
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{formatCurrency(g.mrr, g.moneda)}/mes</span>
            </div>
          </div>
        ))}
      </div>

      <Link href="/servicios" className="inline-block mt-3 text-xs hover:underline" style={{ color: 'var(--color-primary)' }}>
        Ver / ajustar precios en Servicios →
      </Link>
    </div>
  )
}
