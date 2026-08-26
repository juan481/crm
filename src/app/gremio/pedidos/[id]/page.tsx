'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Boxes, TrendingDown } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'

interface PedidoItem {
  id: string
  sku: string | null
  name: string
  precioGremio: number
  precioPublico: number
  quantity: number
}

interface PedidoDetail {
  id: string
  number: number
  status: string
  currency: string
  totalGremio: number
  totalPublico: number
  ahorro: number
  notes: string | null
  createdAt: string
  items: PedidoItem[]
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDIENTE:  { label: 'Pendiente',  color: 'bg-amber-500/10 text-amber-500' },
  CONFIRMADO: { label: 'Confirmado', color: 'bg-blue-500/10 text-blue-400' },
  ENTREGADO:  { label: 'Entregado',  color: 'bg-emerald-500/10 text-emerald-500' },
  CANCELADO:  { label: 'Cancelado',  color: 'bg-red-500/10 text-red-400' },
}

export default function GremioPedidoDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['gremio-pedido', id],
    queryFn: async () => {
      const res = await fetch(`/api/gremio/pedidos/${id}`)
      if (!res.ok) throw new Error('Error al cargar el pedido')
      return res.json()
    },
  })

  const pedido: PedidoDetail | undefined = data?.data

  if (isLoading) return <p className="text-sm text-center py-10" style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
  if (isError || !pedido) return <p className="text-sm text-center py-10" style={{ color: 'var(--color-text-muted)' }}>No se encontró el pedido.</p>

  const status = STATUS_LABELS[pedido.status] ?? STATUS_LABELS.PENDIENTE

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/gremio/pedidos" className="p-2 rounded-lg hover:bg-[var(--color-surface-raised)]">
          <ArrowLeft size={18} style={{ color: 'var(--color-text-muted)' }} />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>Pedido #{String(pedido.number).padStart(3, '0')}</h1>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{formatDateTime(pedido.createdAt)}</p>
        </div>
      </div>

      <div className="space-y-2">
        {pedido.items.map((i) => (
          <div key={i.id} className="surface rounded-2xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-raised)] flex items-center justify-center shrink-0">
              <Boxes size={16} className="opacity-30" style={{ color: 'var(--color-text-muted)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{i.name}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{i.sku ? `${i.sku} · ` : ''}×{i.quantity}</p>
            </div>
            <p className="text-sm font-bold text-emerald-500 shrink-0">{formatCurrency(i.precioGremio * i.quantity, pedido.currency)}</p>
          </div>
        ))}
      </div>

      {pedido.notes && (
        <div className="surface rounded-2xl p-3">
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-subtle)' }}>Notas</p>
          <p className="text-sm" style={{ color: 'var(--color-text)' }}>{pedido.notes}</p>
        </div>
      )}

      <div className="surface rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: 'var(--color-text-muted)' }}>Precio público</span>
          <span className="line-through" style={{ color: 'var(--color-text-subtle)' }}>{formatCurrency(pedido.totalPublico, pedido.currency)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Total Gremio</span>
          <span className="text-xl font-bold text-emerald-500">{formatCurrency(pedido.totalGremio, pedido.currency)}</span>
        </div>
        {pedido.ahorro > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500 pt-1">
            <TrendingDown size={13} /> Ahorraste {formatCurrency(pedido.ahorro, pedido.currency)}
          </div>
        )}
      </div>
    </div>
  )
}
