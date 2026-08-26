'use client'

import { Boxes, Tag } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Product } from '@/types'

interface ProductCardProps {
  product: Product
  onClick?: () => void
  actionSlot?: React.ReactNode
}

/**
 * Tarjeta densa de catálogo — usada en /catalogo y en el selector de
 * productos del Cotizador (desktop, orientada a ver muchas de un vistazo).
 * El portal Gremio tiene su propia tarjeta mobile-first, no ésta.
 *
 * Las fotos del proveedor son thumbnails reales de ~54×54px (así vienen en
 * su Excel, no es un recorte nuestro) — por eso la caja de imagen se
 * mantiene chica: agrandarla sólo hace más visible la falta de resolución
 * real, no la mejora.
 */
export function ProductCard({ product: p, onClick, actionSlot }: ProductCardProps) {
  return (
    <div
      onClick={onClick}
      className="surface rounded-xl overflow-hidden flex flex-col border border-transparent transition-all hover:border-[var(--color-primary)] hover:shadow-md cursor-pointer"
    >
      <div className="aspect-square bg-[var(--color-surface-raised)] flex items-center justify-center overflow-hidden">
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain p-3" loading="lazy" />
        ) : (
          <Boxes size={20} className="opacity-20" style={{ color: 'var(--color-text-muted)' }} />
        )}
      </div>
      <div className="p-2 flex flex-col gap-1 flex-1">
        <p className="text-xs font-medium leading-snug line-clamp-2 min-h-[2rem]" style={{ color: 'var(--color-text)' }}>
          {p.name}
        </p>
        <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-text-subtle)' }}>
          {p.brand && <span className="truncate">{p.brand}</span>}
          {p.sku && <span className="truncate opacity-70">· {p.sku}</span>}
        </div>
        {p.category && (
          <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full w-fit bg-[var(--color-primary-light)] text-[var(--color-primary)]">
            <Tag size={9} /> {p.category.name}
          </span>
        )}
        <div className="mt-auto pt-1 flex items-baseline justify-between gap-1">
          <span className="text-xs font-bold truncate" style={{ color: 'var(--color-text)' }}>
            {formatCurrency(p.price, p.currency)}
          </span>
          {p.precioGremio != null && (
            <span className="text-[10px] font-medium text-emerald-500 shrink-0">
              Gremio {formatCurrency(p.precioGremio, p.currency)}
            </span>
          )}
        </div>
        {actionSlot}
      </div>
    </div>
  )
}
