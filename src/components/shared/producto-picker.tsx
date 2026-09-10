'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Unlink, X } from 'lucide-react'
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

// Buscador de producto (nombre / SKU / MPN, top 25) en un overlay fijo por
// portal — no queda recortado dentro de tablas con overflow y no toca el
// scroll-lock del <body> (ya lo maneja el modal que lo contiene). Reusa
// GET /api/products?search=.
export function ProductoPicker({ open, onPick, onClose, allowNull }: {
  open: boolean
  onPick: (p: ProductoPick | null) => void
  onClose: () => void
  allowNull?: boolean
}) {
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!open) return
    setQ('')
    // Captura + stopImmediatePropagation: Escape cierra SÓLO el picker, no
    // también el modal que lo contiene (que tiene su propio listener en
    // document). El picker está por encima, así que gana.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  const { data } = useQuery({
    queryKey: ['product-search', q],
    queryFn: async () => (await fetch(`/api/products?search=${encodeURIComponent(q)}`)).json(),
    enabled: open && q.trim().length >= 2,
  })
  const results: any[] = data?.data ?? []

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[10001] flex items-start justify-center p-4 pt-[10vh]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl p-3 shadow-2xl"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)' }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold flex-1" style={{ color: 'var(--color-text)' }}>Elegir producto</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--color-surface-raised)]" style={{ color: 'var(--color-text-muted)' }}><X size={16} /></button>
        </div>
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, SKU o modelo..." leftIcon={<Search size={14} />} />
        {allowNull && (
          <button onClick={() => onPick(null)}
            className="w-full flex items-center gap-1.5 px-2 py-2 mt-1.5 rounded-lg text-xs text-left hover:bg-[var(--color-surface-raised)]" style={{ color: 'var(--color-text-muted)' }}>
            <Unlink size={12} /> Dejar sin vincular
          </button>
        )}
        <div className="max-h-64 overflow-y-auto mt-1.5">
          {results.map((p) => (
            <button key={p.id}
              onClick={() => onPick({ id: p.id, name: p.name, sku: p.sku ?? null, costo: p.costo ?? null, price: p.price ?? 0, currency: p.currency ?? 'USD', trackStock: !!p.trackStock, stock: p.stock ?? 0 })}
              className="w-full px-2 py-2 rounded-lg text-xs text-left hover:bg-[var(--color-surface-raised)]">
              <div className="font-medium truncate" style={{ color: 'var(--color-text)' }}>{p.name}</div>
              <div style={{ color: 'var(--color-text-subtle)' }}>
                {p.sku || 'sin SKU'}{p.trackStock ? ` · depósito ${p.stock}` : ' · sin control de stock'}
              </div>
            </button>
          ))}
          {q.trim().length >= 2 && results.length === 0 && (
            <p className="text-xs px-2 py-3" style={{ color: 'var(--color-text-muted)' }}>
              Sin resultados. Cargá el producto desde Catálogo y volvé.
            </p>
          )}
          {q.trim().length < 2 && (
            <p className="text-xs px-2 py-3" style={{ color: 'var(--color-text-subtle)' }}>Escribí al menos 2 letras.</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
