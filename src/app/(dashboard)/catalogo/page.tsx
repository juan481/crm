'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Boxes, Wrench, Building2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/table'
import { SkeletonCard } from '@/components/ui/skeleton'
import { CatalogFilters } from '@/components/catalogo/catalog-filters'
import { ProductCard } from '@/components/catalogo/product-card'
import { ProductDetailModal } from '@/components/catalogo/product-detail-modal'
import { formatCurrency } from '@/lib/utils'
import { useThemeStore } from '@/store/theme-store'
import type { Product, ProductCategory, ProductBrand } from '@/types'

const LIMIT = 36

const BILLING_LABELS: Record<string, string> = {
  MONTHLY: 'mes', QUARTERLY: 'trimestre', ANNUAL: 'año', ONE_TIME: 'único',
}

interface ServiceLite {
  id: string; name: string; description: string | null
  price: number; currency: string; billingCycle: string
}

type Tab = 'PRODUCT' | 'SERVICE'

export default function CatalogoPage() {
  const [tab, setTab] = useState<Tab>('PRODUCT')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [brand, setBrand] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoUrl = useThemeStore((s) => s.logoUrl)

  useEffect(() => {
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  useEffect(() => { setPage(1) }, [categoryId, brand])

  const { data: categoriesData } = useQuery({
    queryKey: ['catalogo-categories'],
    queryFn: async () => {
      const res = await fetch('/api/catalogo/categories')
      if (!res.ok) throw new Error('Error al cargar categorías')
      return res.json()
    },
    enabled: tab === 'PRODUCT',
    staleTime: 5 * 60 * 1000,
  })
  const categories: ProductCategory[] = categoriesData?.data ?? []

  const { data: brandsData } = useQuery({
    queryKey: ['catalogo-brands'],
    queryFn: async () => {
      const res = await fetch('/api/catalogo/brands')
      if (!res.ok) throw new Error('Error al cargar marcas')
      return res.json()
    },
    enabled: tab === 'PRODUCT',
    staleTime: 5 * 60 * 1000,
  })
  const brands: ProductBrand[] = brandsData?.data ?? []

  const { data, isLoading, isError } = useQuery({
    queryKey: ['catalogo-products', debouncedSearch, categoryId, brand, page],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (debouncedSearch.length >= 2) p.set('q', debouncedSearch)
      if (categoryId) p.set('categoryId', categoryId)
      if (brand) p.set('brand', brand)
      const res = await fetch(`/api/catalogo/products?${p}`)
      if (!res.ok) throw new Error('Error al cargar el catálogo')
      return res.json()
    },
    enabled: tab === 'PRODUCT',
    staleTime: 60_000,
  })

  const products: Product[] = data?.data ?? []
  const total: number = data?.total ?? 0
  const totalPages: number = data?.totalPages ?? 1

  const { data: servicesData, isLoading: loadingServices } = useQuery({
    queryKey: ['catalogo-services'],
    queryFn: async () => {
      const res = await fetch('/api/services')
      if (!res.ok) return { data: [] }
      return res.json()
    },
    enabled: tab === 'SERVICE',
    staleTime: 60_000,
  })
  const services: ServiceLite[] = servicesData?.data ?? []
  const filteredServices = debouncedSearch.length >= 2
    ? services.filter((s) => s.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : services

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Catálogo</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Todo lo que se puede vender: productos del proveedor y servicios propios
        </p>
      </div>

      {/* Selector Productos / Servicios */}
      <div className="flex rounded-xl overflow-hidden p-0.5 w-fit"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
        {([
          { type: 'PRODUCT' as Tab, label: 'Productos', icon: <Boxes size={14} /> },
          { type: 'SERVICE' as Tab, label: 'Servicios', icon: <Wrench size={14} /> },
        ]).map((t) => (
          <button key={t.type} onClick={() => { setTab(t.type); setSearch('') }}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === t.type ? 'gradient-bg text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)]" />
        <Input
          placeholder={tab === 'PRODUCT' ? 'Buscar por nombre, SKU o marca...' : 'Buscar servicio...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {tab === 'PRODUCT' && (categories.length > 0 || brands.length > 0) && (
        <CatalogFilters
          categories={categories}
          brands={brands}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          brand={brand}
          onBrandChange={setBrand}
        />
      )}

      {tab === 'PRODUCT' ? (
        <>
          <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
            {total > 0 ? `${total} productos` : ''}
          </p>
          {isError ? (
            <p className="text-sm text-red-400 py-8 text-center">Error al cargar el catálogo.</p>
          ) : isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2.5">
              {Array.from({ length: 16 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Boxes size={32} className="mb-3 opacity-30" style={{ color: 'var(--color-text-muted)' }} />
              <p className="font-medium" style={{ color: 'var(--color-text-muted)' }}>
                No hay productos {debouncedSearch || categoryId || brand ? 'que coincidan con el filtro' : 'cargados todavía'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2.5">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} onClick={() => setDetailProduct(p)} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={setPage} />
          )}
        </>
      ) : (
        loadingServices ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Wrench size={32} className="mb-3 opacity-30" style={{ color: 'var(--color-text-muted)' }} />
            <p className="font-medium" style={{ color: 'var(--color-text-muted)' }}>
              {debouncedSearch ? 'Sin resultados' : 'Sin servicios configurados'}
            </p>
            {!debouncedSearch && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>
                Se crean desde Configuración → Catálogo
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredServices.map((s) => (
              <div key={s.id} className="surface rounded-xl overflow-hidden flex flex-col border border-transparent transition-all hover:border-[var(--color-primary)] hover:shadow-md">
                <div className="aspect-square bg-[var(--color-surface-raised)] flex items-center justify-center overflow-hidden p-6">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Abba" className="max-w-full max-h-full object-contain opacity-90" />
                  ) : (
                    <Building2 size={28} className="opacity-20" style={{ color: 'var(--color-text-muted)' }} />
                  )}
                </div>
                <div className="p-3 flex flex-col gap-1 flex-1">
                  <p className="text-sm font-medium leading-snug line-clamp-2" style={{ color: 'var(--color-text)' }}>{s.name}</p>
                  {s.description && (
                    <p className="text-xs line-clamp-2" style={{ color: 'var(--color-text-subtle)' }}>{s.description}</p>
                  )}
                  <p className="text-sm font-bold mt-auto pt-1" style={{ color: 'var(--color-text)' }}>
                    {formatCurrency(s.price, s.currency)}
                    <span className="text-xs font-normal" style={{ color: 'var(--color-text-subtle)' }}> / {BILLING_LABELS[s.billingCycle] ?? s.billingCycle}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <ProductDetailModal product={detailProduct} onClose={() => setDetailProduct(null)} />
    </div>
  )
}
