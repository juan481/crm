'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Minus, X, ShoppingCart, Boxes, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { useGremioCartStore } from '@/store/gremio-cart-store'
import toast from 'react-hot-toast'

export default function GremioCarritoPage() {
  const router = useRouter()
  const { items, setQuantity, removeItem, clear } = useGremioCartStore()
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const list = Object.values(items)
  const totalGremio = list.reduce((s, i) => s + i.precioGremio * i.quantity, 0)
  const totalPublico = list.reduce((s, i) => s + i.precioPublico * i.quantity, 0)
  const ahorro = totalPublico - totalGremio
  const currency = list[0]?.currency ?? 'USD'

  const handleConfirm = async () => {
    if (list.length === 0) return
    setSaving(true)
    try {
      const res = await fetch('/api/gremio/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: list.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          notes,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al confirmar el pedido'); return }
      clear()
      toast.success(`Pedido #${String(json.data.number).padStart(3, '0')} confirmado`)
      router.push(`/gremio/pedidos/${json.data.id}`)
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShoppingCart size={32} className="mb-3 opacity-30" style={{ color: 'var(--color-text-muted)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Tu carrito está vacío</p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>Buscá productos en el Catálogo para empezar</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Tu carrito</h1>

      <div className="space-y-2">
        {list.map((i) => (
          <div key={i.productId} className="surface rounded-2xl p-3 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[var(--color-surface-raised)] flex items-center justify-center shrink-0">
              <Boxes size={18} className="opacity-30" style={{ color: 'var(--color-text-muted)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{i.name}</p>
              <p className="text-xs text-emerald-500 font-semibold">{formatCurrency(i.precioGremio, i.currency)} c/u</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => (i.quantity <= 1 ? removeItem(i.productId) : setQuantity(i.productId, i.quantity - 1))}
                className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                <Minus size={12} />
              </button>
              <span className="w-6 text-center text-sm font-bold" style={{ color: 'var(--color-text)' }}>{i.quantity}</span>
              <button onClick={() => setQuantity(i.productId, i.quantity + 1)}
                className="w-7 h-7 rounded-lg flex items-center justify-center gradient-bg text-white">
                <Plus size={12} />
              </button>
              <button onClick={() => removeItem(i.productId)} className="ml-1 p-1 hover:text-red-400" style={{ color: 'var(--color-text-subtle)' }}>
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <textarea
        className="w-full rounded-2xl px-4 py-3 text-sm resize-none outline-none"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        rows={2}
        placeholder="Notas para tu pedido (opcional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="surface rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: 'var(--color-text-muted)' }}>Precio público</span>
          <span className="line-through" style={{ color: 'var(--color-text-subtle)' }}>{formatCurrency(totalPublico, currency)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Total Gremio (sin IVA)</span>
          <span className="text-xl font-bold text-emerald-500">{formatCurrency(totalGremio, currency)}</span>
        </div>
        {ahorro > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500 pt-1">
            <TrendingDown size={13} /> Ahorrás {formatCurrency(ahorro, currency)} ({Math.round((ahorro / totalPublico) * 100)}%)
          </div>
        )}
      </div>

      <Button className="w-full" onClick={handleConfirm} loading={saving}>Confirmar pedido</Button>
    </div>
  )
}
