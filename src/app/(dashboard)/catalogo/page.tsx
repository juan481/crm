'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Boxes, Tag } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/table'
import { SkeletonCard } from '@/components/ui/skeleton'
import { cn, formatCurrency } from '@/lib/utils'
import type { Product, ProductCategory } from '@/types'

const LIMIT = 24

export default function CatalogoPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  const { data: categoriesData } = useQuery({
    queryKey: ['catalogo-categories'],
    queryFn: async () => {
      const res = await fetch('/api/catalogo/categories')
      if (!res.ok) throw new Error('Error al cargar categorías')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
  const categories: ProductCategory[] = categoriesData?.data ?? []

  const { data, isLoading, isError } = useQuery({
    queryKey: ['catalogo-products', debouncedSearch, categoryId, page],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (debouncedSearch.length >= 2) p.set('q', debouncedSearch)
      if (categoryId) p.set('categoryId', categoryId)
      const res = await fetch(`/api/catalogo/products?${p}`)
      if (!res.ok) throw new Error('Error al cargar el catálogo')
      return res.json()
    },
    staleTime: 60_000,
  })

  const products: Product[] = data?.data ?? []
  const total: number = data?.total ?? 0
  const totalPages: number = data?.totalPages ?? 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Catálogo</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {total > 0 ? `${total} productos del catálogo del proveedor` : 'Productos del catálogo del proveedor'}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)]" />
          <Input
            placeholder="Buscar por nombre, SKU o marca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setCategoryId(null); setPage(1) }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              !categoryId
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]'
            )}
          >
            Todas
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => { setCategoryId(c.id); setPage(1) }}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                categoryId === c.id
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]'
              )}
            >
              {c.name} <span className="opacity-60">({c.productCount})</span>
            </button>
          ))}
        </div>
      )}

      {isError ? (
        <p className="text-sm text-red-400 py-8 text-center">Error al cargar el catálogo.</p>
      ) : isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Boxes size={32} className="mb-3 opacity-30" style={{ color: 'var(--color-text-muted)' }} />
          <p className="font-medium" style={{ color: 'var(--color-text-muted)' }}>
            No hay productos {debouncedSearch || categoryId ? 'que coincidan con el filtro' : 'cargados todavía'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((p) => (
            <div key={p.id} className="surface rounded-2xl overflow-hidden flex flex-col">
              <div className="aspect-square bg-[var(--color-surface-raised)] flex items-center justify-center overflow-hidden">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain p-2" loading="lazy" />
                ) : (
                  <Boxes size={28} className="opacity-20" style={{ color: 'var(--color-text-muted)' }} />
                )}
              </div>
              <div className="p-3 flex flex-col gap-1.5 flex-1">
                <p className="text-sm font-medium leading-snug line-clamp-2" style={{ color: 'var(--color-text)' }}>{p.name}</p>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                  {p.brand && <span className="truncate">{p.brand}</span>}
                  {p.sku && <span className="truncate opacity-70">· {p.sku}</span>}
                </div>
                {p.category && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full w-fit bg-[var(--color-primary-light)] text-[var(--color-primary)]">
                    <Tag size={10} /> {p.category.name}
                  </span>
                )}
                <div className="mt-auto pt-1.5 flex items-baseline justify-between">
                  <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                    {formatCurrency(p.price, p.currency)}
                  </span>
                  {p.precioGremio != null && (
                    <span className="text-[11px] font-medium text-emerald-500">
                      Gremio {formatCurrency(p.precioGremio, p.currency)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={setPage} />
      )}
    </div>
  )
}
