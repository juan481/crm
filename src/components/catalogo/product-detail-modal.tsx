'use client'

import { Boxes, Tag, ShoppingCart } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import type { Product } from '@/types'

interface ProductDetailModalProps {
  product: Product | null
  onClose: () => void
  onAdd?: (product: Product) => void
  addLabel?: string
}

/**
 * Detalle de un producto del catálogo — mismo modal para /catalogo, el
 * Cotizador y el portal Gremio. `onAdd` es opcional: en /catalogo (sólo
 * lectura) no se pasa; en el Cotizador y en Gremio sí, y ahí aparece el
 * botón de agregar.
 */
export function ProductDetailModal({ product: p, onClose, onAdd, addLabel = 'Agregar' }: ProductDetailModalProps) {
  if (!p) return null

  return (
    <Modal open={!!p} onClose={onClose} title={p.name} size="md">
      <div className="flex flex-col gap-4">
        <div className="w-full aspect-[4/3] max-h-64 rounded-xl bg-[var(--color-surface-raised)] flex items-center justify-center overflow-hidden">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt={p.name} className="max-w-[70%] max-h-[70%] object-contain" />
          ) : (
            <Boxes size={40} className="opacity-20" style={{ color: 'var(--color-text-muted)' }} />
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {p.brand && (
            <span className="text-xs px-2 py-1 rounded-full bg-[var(--color-surface-raised)]" style={{ color: 'var(--color-text-muted)' }}>
              Marca: {p.brand}
            </span>
          )}
          {p.sku && (
            <span className="text-xs px-2 py-1 rounded-full bg-[var(--color-surface-raised)]" style={{ color: 'var(--color-text-muted)' }}>
              SKU: {p.sku}
            </span>
          )}
          {p.mpn && (
            <span className="text-xs px-2 py-1 rounded-full bg-[var(--color-surface-raised)]" style={{ color: 'var(--color-text-muted)' }}>
              Modelo: {p.mpn}
            </span>
          )}
          {p.category && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)]">
              <Tag size={11} /> {p.category.name}
            </span>
          )}
        </div>

        {p.description && (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{p.description}</p>
        )}

        {p.supplierAvailability && (
          <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
            Disponibilidad del proveedor: {p.supplierAvailability}
          </p>
        )}

        <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <p className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>Precio público</p>
            <p className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{formatCurrency(p.price, p.currency)} <span className="text-xs font-normal">/ {p.unit}</span></p>
          </div>
          {p.precioGremio != null && (
            <div className="text-right">
              <p className="text-[11px] text-emerald-500">Precio Gremio</p>
              <p className="text-lg font-bold text-emerald-500">{formatCurrency(p.precioGremio, p.currency)}</p>
            </div>
          )}
        </div>

        {onAdd && (
          <Button onClick={() => onAdd(p)} leftIcon={<ShoppingCart size={16} />} className="w-full">
            {addLabel}
          </Button>
        )}
      </div>
    </Modal>
  )
}
