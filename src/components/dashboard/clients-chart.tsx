'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { CLIENT_STATUS_LABELS } from '@/lib/utils'

interface ClientsChartProps {
  data: { status: string; count: number }[]
}

const COLORS = {
  ACTIVE: '#22c55e',
  INACTIVE: '#64748b',
  PENDING_PAYMENT: '#f59e0b',
  EXPIRED: '#ef4444',
  PROSPECT: '#3b82f6',
}

export function ClientsChart({ data }: ClientsChartProps) {
  const chartData = data.map((d) => ({
    name: CLIENT_STATUS_LABELS[d.status] ?? d.status,
    value: d.count,
    color: COLORS[d.status as keyof typeof COLORS] ?? '#6366f1',
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clientes por Estado</CardTitle>
      </CardHeader>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [value, name]}
              contentStyle={{
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '12px',
                fontFamily: 'Poppins',
                fontSize: '13px',
                color: 'var(--color-text)',
              }}
            />
            <Legend
              formatter={(value) => (
                <span style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontFamily: 'Poppins' }}>
                  {value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
