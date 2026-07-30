'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'

interface ClientsChartProps {
  data: { status: string; count: number }[]
}

const INVOICE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  PAID: 'Pagada',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelada',
}

const COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  PAID: '#22c55e',
  OVERDUE: '#ef4444',
  CANCELLED: '#64748b',
}

export function ClientsChart({ data }: ClientsChartProps) {
  const chartData = data.map((d) => ({
    name: INVOICE_STATUS_LABELS[d.status] ?? d.status,
    value: d.count,
    color: COLORS[d.status] ?? '#6366f1',
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Facturas por Estado</CardTitle>
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
