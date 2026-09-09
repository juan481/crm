'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

export interface ProductoPick {
  id: string
  name: string
  sku: string | null
  costo: number | null
  price: number
  currency: string
  trackStock: boolean
  stock: number
}

// Popover de búsqueda de producto (nombre / SKU / MPN, top 25). Reusa
// GET /api/products?search=. El contenedor debe tener position:relative.
export function ProductoPicker({ onPick, onClose, allowNull }: {
  onPick: (p: ProductoPick | null) => void
  onClose: () => void
  allowNull?: boolean
}) {
  const [q, setQ] = useState('')
  const { data } = useQuery({
    queryKey: ['product-search', q],
    queryFn: async () => (await fetch(`/api/products?search=${encodeURIComponent(q)}`)).json(),
    enabled: q.trim().length >= 2,
  })
  const results: any[] = data?.data ?? []

  return (
    <div className="absolute z-30 mt-1 w-72 rounded-xl p-2 shadow-xl"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)' }}>
      <div className="flex items-center gap-1 mb-1.5">
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto..." leftIcon={<Search size={13} />} />
        <button onClick={onClose} className="shrink-0 p-1" style={{ color: 'var(--color-text-muted)' }}><X size={14} /></button>
      </div>
      {allowNull && (
        <button onClick={() => onPick(null)}
          className="w-full px-2 py-1.5 rounded-lg text-xs text-left hover:bg-[var(--color-surface-raised)]" style={{ color: 'var(--color-text-muted)' }}>
          Dejar sin vincular
        </button>
      )}
      <div className="max-h-52 overflow-y-auto mt-1">
        {results.map((p) => (
          <button key={p.id}
            onClick={() => onPick({ id: p.id, name: p.name, sku: p.sku ?? null, costo: p.costo ?? null, price: p.price ?? 0, currency: p.currency ?? 'USD', trackStock: !!p.trackStock, stock: p.stock ?? 0 })}
            className="w-full px-2 py-1.5 rounded-lg text-xs text-left hover:bg-[var(--color-surface-raised)]">
            <div className="font-medium truncate" style={{ color: 'var(--color-text)' }}>{p.name}</div>
            <div style={{ color: 'var(--color-text-subtle)' }}>
              {p.sku || 'sin SKU'}{p.trackStock ? ` · depósito ${p.stock}` : ' · sin control de stock'}
            </div>
          </button>
        ))}
        {q.trim().length >= 2 && results.length === 0 && (
          <p className="text-xs px-2 py-2" style={{ color: 'var(--color-text-muted)' }}>Sin resultados.</p>
        )}
      </div>
    </div>
  )
}
