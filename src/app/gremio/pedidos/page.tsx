'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Receipt, ChevronRight } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface PedidoRow {
  id: string
  number: number
  totalGremio: number
  currency: string
  status: 'PENDIENTE' | 'CONFIRMADO' | 'ENTREGADO' | 'CANCELADO'
  createdAt: string
  items: { id: string }[]
}

const STATUS_LABELS: Record<PedidoRow['status'], { label: string; color: string }> = {
  PENDIENTE:  { label: 'Pendiente',  color: 'bg-amber-500/10 text-amber-500' },
  CONFIRMADO: { label: 'Confirmado', color: 'bg-blue-500/10 text-blue-400' },
  ENTREGADO:  { label: 'Entregado',  color: 'bg-emerald-500/10 text-emerald-500' },
  CANCELADO:  { label: 'Cancelado',  color: 'bg-red-500/10 text-red-400' },
}

export default function GremioPedidosPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['gremio-pedidos'],
    queryFn: async () => {
      const res = await fetch('/api/gremio/pedidos')
      if (!res.ok) throw new Error('Error al cargar pedidos')
      return res.json()
    },
  })

  const pedidos: PedidoRow[] = data?.data ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Mis Pedidos</h1>

      {isLoading ? (
        <p className="text-sm text-center py-10" style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
      ) : pedidos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Receipt size={28} className="mb-3 opacity-30" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Todavía no hiciste ningún pedido</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pedidos.map((p) => {
            const status = STATUS_LABELS[p.status]
            return (
              <Link key={p.id} href={`/gremio/pedidos/${p.id}`} className="surface rounded-2xl p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Pedido #{String(p.number).padStart(3, '0')}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-subtle)' }}>
                    {p.items.length} ítem{p.items.length !== 1 ? 's' : ''} · {formatDate(p.createdAt)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-emerald-500">{formatCurrency(p.totalGremio, p.currency)}</p>
                </div>
                <ChevronRight size={16} className="shrink-0" style={{ color: 'var(--color-text-subtle)' }} />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
