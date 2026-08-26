'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Boxes, Plus, Minus, ShoppingCart } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/table'
import { SkeletonCard } from '@/components/ui/skeleton'
import { CatalogFilters } from '@/components/catalogo/catalog-filters'
import { ProductDetailModal } from '@/components/catalogo/product-detail-modal'
import { formatCurrency } from '@/lib/utils'
import { useGremioCartStore } from '@/store/gremio-cart-store'
import type { Product, ProductCategory, ProductBrand } from '@/types'
import toast from 'react-hot-toast'

const LIMIT = 12

export default function GremioCatalogoPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [brand, setBrand] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { items: cartItems, addItem, setQuantity } = useGremioCartStore()

  useEffect(() => {
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  useEffect(() => { setPage(1) }, [categoryId, brand])

  const { data: categoriesData } = useQuery({
    queryKey: ['gremio-categories'],
    queryFn: async () => {
      const res = await fetch('/api/catalogo/categories')
      if (!res.ok) throw new Error('Error al cargar categorías')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
  const categories: ProductCategory[] = categoriesData?.data ?? []

  const { data: brandsData } = useQuery({
    queryKey: ['gremio-brands'],
    queryFn: async () => {
      const res = await fetch('/api/catalogo/brands')
      if (!res.ok) throw new Error('Error al cargar marcas')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
  const brands: ProductBrand[] = brandsData?.data ?? []

  const { data, isLoading } = useQuery({
    queryKey: ['gremio-catalogo-products', debouncedSearch, categoryId, brand, page],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (debouncedSearch.length >= 2) p.set('q', debouncedSearch)
      if (categoryId) p.set('categoryId', categoryId)
      if (brand) p.set('brand', brand)
      const res = await fetch(`/api/catalogo/products?${p}`)
      if (!res.ok) throw new Error('Error al cargar el catálogo')
      return res.json()
    },
    staleTime: 60_000,
  })

  const products: Product[] = data?.data ?? []
  const total: number = data?.total ?? 0
  const totalPages: number = data?.totalPages ?? 1

  const handleAdd = (p: Product) => {
    if (p.precioGremio == null) return
    addItem({ productId: p.id, sku: p.sku ?? null, name: p.name, precioGremio: p.precioGremio, precioPublico: p.price, currency: p.currency }, 1)
    toast.success(`${p.name} agregado al carrito`)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Catálogo</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-subtle)' }}>
          {total > 0 ? `${total} productos disponibles` : 'Buscá productos para armar tu pedido'}
        </p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)]" />
        <Input placeholder="Buscar producto o SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {(categories.length > 0 || brands.length > 0) && (
        <CatalogFilters
          categories={categories}
          brands={brands}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          brand={brand}
          onBrandChange={setBrand}
          className="grid grid-cols-1 gap-2"
        />
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Boxes size={28} className="mb-3 opacity-30" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>No hay productos que coincidan</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => {
            const inCartQty = cartItems[p.id]?.quantity ?? 0
            const hasGremio = p.precioGremio != null
            const ahorroPct = hasGremio ? Math.round((1 - (p.precioGremio! / p.price)) * 100) : 0
            return (
              <div
                key={p.id}
                onClick={() => setDetailProduct(p)}
                className="surface rounded-2xl overflow-hidden flex flex-col border border-transparent transition-all active:scale-[0.98] hover:border-[var(--color-primary)] hover:shadow-md cursor-pointer"
              >
                <div className="aspect-square bg-[var(--color-surface-raised)] flex items-center justify-center overflow-hidden">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain p-2" loading="lazy" />
                  ) : (
                    <Boxes size={24} className="opacity-20" style={{ color: 'var(--color-text-muted)' }} />
                  )}
                </div>
                <div className="p-2.5 flex flex-col gap-1 flex-1">
                  <p className="text-xs font-medium leading-snug line-clamp-2" style={{ color: 'var(--color-text)' }}>{p.name}</p>
                  <div className="mt-auto">
                    {hasGremio ? (
                      <>
                        <p className="text-[10px] line-through" style={{ color: 'var(--color-text-subtle)' }}>{formatCurrency(p.price, p.currency)}</p>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-emerald-500">{formatCurrency(p.precioGremio!, p.currency)}</p>
                          {ahorroPct > 0 && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-500">-{ahorroPct}%</span>}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{formatCurrency(p.price, p.currency)}</p>
                    )}
                  </div>
                  {inCartQty > 0 ? (
                    <div className="flex items-center justify-between gap-1 mt-1">
                      <button onClick={(e) => { e.stopPropagation(); setQuantity(p.id, inCartQty - 1) }} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                        <Minus size={12} />
                      </button>
                      <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{inCartQty}</span>
                      <button onClick={(e) => { e.stopPropagation(); addItem({ productId: p.id, sku: p.sku ?? null, name: p.name, precioGremio: p.precioGremio ?? p.price, precioPublico: p.price, currency: p.currency }, 1) }} className="w-7 h-7 rounded-lg flex items-center justify-center gradient-bg text-white">
                        <Plus size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAdd(p) }}
                      className="mt-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold gradient-bg text-white"
                    >
                      <ShoppingCart size={12} /> Agregar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={setPage} />
      )}

      <ProductDetailModal
        product={detailProduct}
        onClose={() => setDetailProduct(null)}
        onAdd={(p) => { handleAdd(p); setDetailProduct(null) }}
        addLabel="Agregar al pedido"
      />
    </div>
  )
}
