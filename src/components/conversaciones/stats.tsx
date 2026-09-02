'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Bot, User, ArrowRightLeft, AlertTriangle, MessageSquare, Inbox } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface Stats {
  days: number
  totales: { total: number; activasNissi: number; conHumano: number; derivadas: number; cerradas: number; sinLeer: number }
  periodo: { nuevas: number; resueltasPorNissi: number; derivadas: number; tomadasPorHumano: number; pctNissi: number }
  mensajes: { entrantes: number; deNissi: number; deHumanos: number; fallidos: number; total: number; promedioPorConversacion: number }
  derivacionesPorArea: Record<string, number>
  leads: Record<string, number>
  porDia: { date: string; nuevas: number; mensajes: number }[]
}

const AREA_LABEL: Record<string, string> = { VENTAS: 'Ventas', SOPORTE: 'Soporte', ADMINISTRACION: 'Administración', OTRO: 'Otro' }
const LEAD_LABEL: Record<string, string> = {
  compra: 'Compra de equipos', instalacion_nueva: 'Instalación', gremio: 'Gremio', asesor: 'Pidió un asesor', sin_clasificar: 'Sin clasificar',
}

function Tile({ label, value, sub, icon, tone = 'neutral' }: { label: string; value: string | number; sub?: string; icon?: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'danger' | 'primary' }) {
  const toneColor = { neutral: 'var(--color-text)', good: '#059669', warn: '#b45309', danger: '#dc2626', primary: 'var(--color-primary)' }[tone]
  return (
    <div className="surface rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mb-1">
        {icon}{label}
      </div>
      <div className="text-2xl font-bold" style={{ color: toneColor }}>{value}</div>
      {sub && <div className="text-[11px] text-[var(--color-text-subtle)] mt-0.5">{sub}</div>}
    </div>
  )
}

function Barra({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[var(--color-text-muted)]">{label}</span>
        <span className="font-semibold text-[var(--color-text)]">{value}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-raised)' }}>
        <div className="h-full rounded-full" style={{ width: `${max ? Math.round((value / max) * 100) : 0}%`, background: color }} />
      </div>
    </div>
  )
}

export function ConversacionesStats() {
  const [days, setDays] = useState(30)
  const { data, isLoading, isError } = useQuery<{ data: Stats }>({
    queryKey: ['conversaciones-stats', days],
    queryFn: async () => {
      const r = await fetch(`/api/conversaciones/stats?days=${days}`)
      if (!r.ok) throw new Error()
      return r.json()
    },
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:overflow-y-auto">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
    )
  }
  if (isError || !data) {
    return <p className="text-sm text-center text-[var(--color-text-muted)] py-10">No se pudieron cargar las estadísticas.</p>
  }

  const s = data.data
  const areas = Object.entries(s.derivacionesPorArea)
  const leads = Object.entries(s.leads)
  const maxArea = Math.max(1, ...areas.map(([, v]) => v))
  const maxMsg = Math.max(1, s.mensajes.entrantes, s.mensajes.deNissi, s.mensajes.deHumanos)

  return (
    <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto space-y-4 pb-4">
      <div className="flex justify-end gap-1">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={cn('px-3 py-1 rounded-lg text-xs font-medium', days === d ? 'gradient-bg text-white' : 'text-[var(--color-text-muted)] bg-[var(--color-surface-raised)]')}
          >
            {d} días
          </button>
        ))}
      </div>

      {/* Estado actual */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-subtle)] mb-2">Ahora mismo</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile label="Conversaciones" value={s.totales.total} icon={<MessageSquare size={13} />} />
          <Tile label="Sin leer" value={s.totales.sinLeer} tone={s.totales.sinLeer > 0 ? 'warn' : 'neutral'} icon={<Inbox size={13} />} />
          <Tile label="Las maneja NISSI" value={s.totales.activasNissi} tone="good" icon={<Bot size={13} />} />
          <Tile label="Con un humano" value={s.totales.conHumano} tone="primary" icon={<User size={13} />} />
        </div>
      </div>

      {/* Período */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-subtle)] mb-2">Últimos {s.days} días</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile label="Conversaciones nuevas" value={s.periodo.nuevas} />
          <Tile label="Sólo NISSI (sin humano)" value={`${s.periodo.pctNissi}%`} sub={`${s.periodo.resueltasPorNissi} de ${s.periodo.nuevas}`} tone="good" />
          <Tile label="Derivadas a un área" value={s.periodo.derivadas} icon={<ArrowRightLeft size={13} />} />
          <Tile label="Tomó un humano" value={s.periodo.tomadasPorHumano} icon={<User size={13} />} />
        </div>
      </div>

      {/* Actividad diaria */}
      <Card>
        <p className="text-sm font-semibold text-[var(--color-text)] mb-1">Actividad de los últimos 14 días</p>
        <div className="h-40 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={s.porDia} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap="20%">
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => d.slice(8, 10)}
                tick={{ fill: 'var(--color-text-subtle)', fontSize: 10 }}
                axisLine={false} tickLine={false}
                interval={1}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-surface-raised)' }}
                labelFormatter={(d: string) => d.split('-').reverse().join('/')}
                formatter={(v: number) => [v, 'Mensajes']}
                contentStyle={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-strong)', borderRadius: 12, fontFamily: 'Poppins', fontSize: 12, color: 'var(--color-text)' }}
              />
              <Bar dataKey="mensajes" radius={[3, 3, 0, 0]} maxBarSize={22}>
                {s.porDia.map((_, i) => <Cell key={i} fill="var(--color-primary)" fillOpacity={0.75} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Mensajes */}
        <Card>
          <p className="text-sm font-semibold text-[var(--color-text)] mb-3">Mensajes ({s.mensajes.total} en total)</p>
          <div className="space-y-2.5">
            <Barra label="Del cliente" value={s.mensajes.entrantes} max={maxMsg} color="var(--color-text-subtle)" />
            <Barra label="De NISSI" value={s.mensajes.deNissi} max={maxMsg} color="var(--color-primary)" />
            <Barra label="De humanos (desde el CRM)" value={s.mensajes.deHumanos} max={maxMsg} color="#10b981" />
          </div>
          <div className="flex justify-between text-xs mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <span className="text-[var(--color-text-muted)]">Promedio por conversación</span>
            <span className="font-semibold text-[var(--color-text)]">{s.mensajes.promedioPorConversacion}</span>
          </div>
          {s.mensajes.fallidos > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 mt-2">
              <AlertTriangle size={13} /> {s.mensajes.fallidos} mensaje{s.mensajes.fallidos > 1 ? 's' : ''} no se pudo{s.mensajes.fallidos > 1 ? 'ieron' : ''} enviar
            </div>
          )}
        </Card>

        {/* Derivaciones + leads */}
        <Card>
          <p className="text-sm font-semibold text-[var(--color-text)] mb-3">Derivaciones por área</p>
          {areas.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">Ninguna derivación en el período.</p>
          ) : (
            <div className="space-y-2.5">
              {areas.map(([k, v]) => (
                <Barra key={k} label={AREA_LABEL[k] ?? k} value={v} max={maxArea} color="var(--color-primary)" />
              ))}
            </div>
          )}
          {leads.length > 0 && (
            <>
              <p className="text-sm font-semibold text-[var(--color-text)] mt-4 mb-2">Oportunidades creadas por NISSI</p>
              <div className="flex flex-wrap gap-1.5">
                {leads.map(([k, v]) => (
                  <span key={k} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                    {LEAD_LABEL[k] ?? k}: <b className="text-[var(--color-text)]">{v}</b>
                  </span>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
