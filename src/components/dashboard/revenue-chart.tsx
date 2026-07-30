'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

interface RevenueChartProps {
  data: { month: string; byCurrency: Record<string, number> }[]
}

// Colores por serie — hasta 3 monedas distintas antes de repetir.
const SERIES_COLORS = ['var(--color-primary)', '#f59e0b', '#22c55e']

export function RevenueChart({ data }: RevenueChartProps) {
  // Un monto en USD y otro en ARS no son la misma unidad: nunca se suman.
  // Se grafica una serie por moneda realmente usada (default a USD si no
  // hay ninguna factura pagada todavía, para no mostrar un gráfico vacío).
  const currencies = Array.from(new Set(data.flatMap((d) => Object.keys(d.byCurrency))))
  if (currencies.length === 0) currencies.push('USD')

  const chartData = data.map((d) => ({
    month: d.month,
    ...Object.fromEntries(currencies.map((c) => [c, d.byCurrency[c] ?? 0])),
  }))

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Ingresos Recurrentes (MRR)</CardTitle>
        <p className="text-xs text-[var(--color-text-subtle)]">Últimos 6 meses</p>
      </CardHeader>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              {currencies.map((cur, i) => (
                <linearGradient key={cur} id={`revenueGrad-${cur}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: 'var(--color-text-subtle)', fontFamily: 'Poppins' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 11, fill: 'var(--color-text-subtle)', fontFamily: 'Poppins' }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              formatter={(value: number, name: string) => [formatCurrency(value, name), name]}
              contentStyle={{
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '12px',
                fontFamily: 'Poppins',
                fontSize: '13px',
                color: 'var(--color-text)',
              }}
            />
            {currencies.length > 1 && <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Poppins' }} />}
            {currencies.map((cur, i) => (
              <Area
                key={cur}
                type="monotone"
                dataKey={cur}
                name={cur}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth={2.5}
                fill={`url(#revenueGrad-${cur})`}
                dot={{ r: 4, fill: SERIES_COLORS[i % SERIES_COLORS.length], strokeWidth: 2, stroke: 'var(--color-surface)' }}
                activeDot={{ r: 6, fill: SERIES_COLORS[i % SERIES_COLORS.length] }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
