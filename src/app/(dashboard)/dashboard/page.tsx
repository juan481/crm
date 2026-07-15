'use client'

import { useQuery } from '@tanstack/react-query'
import { Users, DollarSign, AlertCircle, Clock, UserPlus, TrendingUp, CheckSquare, Headphones, FileText } from 'lucide-react'
import Link from 'next/link'
import { MetricCard } from '@/components/dashboard/metric-card'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { ClientsChart } from '@/components/dashboard/clients-chart'
import { SkeletonCard } from '@/components/ui/skeleton'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, CLIENT_STATUS_LABELS, CLIENT_STATUS_COLORS } from '@/lib/utils'
import { usePlugin } from '@/hooks/use-plugin'
import type { DashboardMetrics, Client } from '@/types'

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/metrics')
      if (!res.ok) throw new Error('Error al cargar métricas')
      const json = await res.json()
      return json.data
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })

  const { enabled: analyticsEnabled } = usePlugin('advanced-analytics')

  const { data: topClients } = useQuery<Client[]>({
    queryKey: ['top-clients'],
    queryFn: async () => {
      const res = await fetch('/api/clients?limit=5&page=1')
      if (!res.ok) return []
      const json = await res.json()
      return (json.data ?? []).sort((a: Client, b: Client) => b.mrr - a.mrr)
    },
    enabled: analyticsEnabled,
    staleTime: 5 * 60 * 1000,
  })

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-[var(--color-text-muted)]">Error al cargar el dashboard</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Dashboard</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Resumen de tu negocio en tiempo real
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricCard
              title="Clientes Activos"
              value={data?.activeClients ?? 0}
              icon={<Users size={20} />}
              href="/clientes"
              index={0}
            />
            <MetricCard
              title="Ingresos del Mes"
              value={formatCurrency(data?.mrr ?? 0)}
              icon={<DollarSign size={20} />}
              trend={data?.mrrGrowth}
              trendLabel="crecimiento mensual"
              accentColor="#22c55e"
              href="/facturas"
              index={1}
            />
            <MetricCard
              title="Pagos Pendientes"
              value={data?.pendingPayment ?? 0}
              icon={<Clock size={20} />}
              subtitle="clientes con pago pendiente"
              accentColor="#f59e0b"
              href="/clientes"
              index={2}
            />
            <MetricCard
              title="Servicios Vencidos"
              value={data?.expiredServices ?? 0}
              icon={<AlertCircle size={20} />}
              subtitle="requieren atención"
              accentColor="#ef4444"
              href="/clientes"
              index={3}
            />
          </>
        )}
      </div>

      {/* Charts */}
      <ErrorBoundary>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <>
              <div className="lg:col-span-2 h-72 surface rounded-2xl animate-pulse" />
              <div className="h-72 surface rounded-2xl animate-pulse" />
            </>
          ) : (
            <>
              <RevenueChart data={data?.revenueByMonth ?? []} />
              <ClientsChart data={data?.clientsByStatus ?? []} />
            </>
          )}
        </div>
      </ErrorBoundary>

      {/* Quick stats */}
      {!isLoading && data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="surface rounded-2xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
              <UserPlus size={20} />
            </div>
            <div>
              <p className="text-xl font-bold text-[var(--color-text)]">{data.newClientsThisMonth}</p>
              <p className="text-sm text-[var(--color-text-muted)]">Nuevos este mes</p>
            </div>
          </div>
          <div className="surface rounded-2xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-xl font-bold text-[var(--color-text)]">
                {formatCurrency((data.mrr ?? 0) * 12)}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">Ingresos anuales est.</p>
            </div>
          </div>
          <div className="surface rounded-2xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-xl font-bold text-[var(--color-text)]">
                {data.activeClients > 0
                  ? formatCurrency((data.mrr ?? 0) / data.activeClients)
                  : '$0'}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">Ingreso por cliente</p>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline / Tasks / Tickets / Cotizaciones summary */}
      {!isLoading && data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Link href="/pipeline" className="surface rounded-2xl p-5 flex items-center gap-4 hover:border-[var(--color-border-strong)] transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 group-hover:bg-indigo-500/20 transition-colors">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-xl font-bold text-[var(--color-text)]">{data.activeDealsCount}</p>
              <p className="text-sm text-[var(--color-text-muted)]">Deals activos · {formatCurrency(data.pipelineValue)} esp.</p>
            </div>
          </Link>
          <Link href="/tareas" className="surface rounded-2xl p-5 flex items-center gap-4 hover:border-[var(--color-border-strong)] transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0 group-hover:bg-amber-500/20 transition-colors">
              <CheckSquare size={20} />
            </div>
            <div>
              <p className="text-xl font-bold text-[var(--color-text)]">{data.pendingTasks}</p>
              <p className="text-sm text-[var(--color-text-muted)]">Tareas pendientes</p>
            </div>
          </Link>
          <Link href="/tickets" className="surface rounded-2xl p-5 flex items-center gap-4 hover:border-[var(--color-border-strong)] transition-colors group">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${data.openTickets > 0 ? 'bg-red-500/10 text-red-400 group-hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20'}`}>
              <Headphones size={20} />
            </div>
            <div>
              <p className="text-xl font-bold text-[var(--color-text)]">{data.openTickets}</p>
              <p className="text-sm text-[var(--color-text-muted)]">Tickets abiertos</p>
            </div>
          </Link>
          <Link href="/cotizaciones" className="surface rounded-2xl p-5 hover:border-[var(--color-border-strong)] transition-colors group">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400 shrink-0 group-hover:bg-violet-500/20 transition-colors">
                <FileText size={20} />
              </div>
              <div>
                <p className="text-xl font-bold text-[var(--color-text)]">{data.cotizacionesEnviadas}</p>
                <p className="text-sm text-[var(--color-text-muted)]">Cotizaciones enviadas</p>
              </div>
            </div>
            {data.cotizacionesEnviadas > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.round((data.cotizacionesAceptadas / data.cotizacionesEnviadas) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-emerald-500 shrink-0">
                  {Math.round((data.cotizacionesAceptadas / data.cotizacionesEnviadas) * 100)}% conv.
                </span>
              </div>
            )}
          </Link>
        </div>
      )}

      {/* Pipeline stage breakdown */}
      {!isLoading && data && data.activeDealsCount > 0 && (
        <div className="surface rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-primary)' }} />
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Pipeline por etapa</h2>
            </div>
            <Link href="/pipeline" className="text-xs text-[var(--color-text-subtle)] hover:text-[var(--color-primary)] transition-colors">
              Ver tablero →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(
              [
                { stage: 'LEAD',        label: 'Lead',        color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
                { stage: 'CONTACTADO',  label: 'Contactado',  color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
                { stage: 'PROPUESTA',   label: 'Propuesta',   color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
                { stage: 'NEGOCIACION', label: 'Negociación', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
              ] as const
            ).map(({ stage, label, color, bg }) => {
              const count = data.dealsByStage[stage] ?? 0
              return (
                <div key={stage} className="rounded-xl p-3 text-center" style={{ background: bg }}>
                  <p className="text-2xl font-bold" style={{ color }}>{count}</p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Advanced Analytics (plugin gated) */}
      {analyticsEnabled && topClients && topClients.length > 0 && (
        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Top Clientes por Ingreso</h2>
            <span className="text-xs text-[var(--color-text-subtle)] bg-[var(--color-primary-light)] text-[var(--color-primary)] px-2 py-0.5 rounded-full ml-1">
              Analíticas Avanzadas
            </span>
          </div>
          <div className="space-y-3">
            {topClients.map((client, i) => (
              <div key={client.id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-[var(--color-text-subtle)] w-5 text-right">
                  {i + 1}
                </span>
                <Avatar name={client.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)] truncate">{client.name}</p>
                  <p className="text-xs text-[var(--color-text-subtle)] truncate">{client.serviceType ?? '—'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-[var(--color-text)]">{formatCurrency(client.mrr)}</p>
                  <p className="text-xs text-[var(--color-text-subtle)]">/mes</p>
                </div>
                <Badge
                  variant={CLIENT_STATUS_COLORS[client.status] as 'success' | 'warning' | 'danger' | 'info' | 'neutral'}
                  size="sm"
                  dot
                >
                  {CLIENT_STATUS_LABELS[client.status]}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
