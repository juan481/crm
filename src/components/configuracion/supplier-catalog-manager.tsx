'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, RefreshCw, Boxes, CheckCircle, XCircle, Pencil, Settings2, EyeOff, Eye } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Pagination } from '@/components/ui/table'
import { SkeletonCard } from '@/components/ui/skeleton'
import { CatalogFilters } from '@/components/catalogo/catalog-filters'
import { formatCurrency, formatDateTime, cn } from '@/lib/utils'
import { usePlugin } from '@/hooks/use-plugin'
import type { Product, ProductCategory, ProductBrand } from '@/types'
import type { CatalogSyncResult } from '@/lib/catalogo-sync'
import toast from 'react-hot-toast'

const LIMIT = 24

interface EditForm {
  price: string
  precioGremio: string
  costo: string
  ivaPct: string
  supplier: string
  supplierAvailability: string
  active: boolean
}

const STATUS_OPTIONS = [
  { value: 'active',   label: 'Activos' },
  { value: 'inactive', label: 'Dados de baja' },
  { value: 'all',      label: 'Todos' },
]

// Catálogo importado del proveedor (Excel / Google Sheets) — a diferencia
// de "Tus productos" (SimpleProductsManager), acá nunca se crea nada a
// mano: sólo se sincroniza, se busca/filtra, y se puede dar de baja un SKU
// puntual (active:false) sin borrarlo. Borrarlo de verdad no serviría de
// nada: si el sync sigue trayendo ese SKU del Sheet, reaparecería solo en
// la próxima corrida — por eso el "dar de baja" es un toggle, no un
// DELETE, y por eso el sync (ver catalogo-sync.ts) nunca toca `active` por
// su cuenta.
export function SupplierCatalogManager() {
  const qc = useQueryClient()
  const { enabled: sheetsEnabled, config: sheetsConfig } = usePlugin('catalogo-google-sheets')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [brand, setBrand] = useState<string | null>(null)
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active')
  const [page, setPage] = useState(1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  useEffect(() => { setPage(1) }, [categoryId, brand, status])

  const { data: categoriesData } = useQuery({
    queryKey: ['catalogo-admin-categories'],
    queryFn: async () => (await fetch('/api/catalogo/categories')).json(),
    staleTime: 5 * 60_000,
  })
  const categories: ProductCategory[] = categoriesData?.data ?? []

  const { data: brandsData } = useQuery({
    queryKey: ['catalogo-admin-brands'],
    queryFn: async () => (await fetch('/api/catalogo/brands')).json(),
    staleTime: 5 * 60_000,
  })
  const brands: ProductBrand[] = brandsData?.data ?? []

  const { data, isLoading } = useQuery({
    queryKey: ['catalogo-admin-products', debouncedSearch, categoryId, brand, status, page],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT), status })
      if (debouncedSearch.length >= 2) p.set('q', debouncedSearch)
      if (categoryId) p.set('categoryId', categoryId)
      if (brand) p.set('brand', brand)
      const res = await fetch(`/api/catalogo/products?${p}`)
      if (!res.ok) throw new Error('Error al cargar')
      return res.json()
    },
    staleTime: 30_000,
  })

  const products: Product[] = data?.data ?? []
  const total: number = data?.total ?? 0
  const totalPages: number = data?.totalPages ?? 1
  const lastSynced = products.find((p) => p.lastSyncedAt)?.lastSyncedAt ?? null

  const invalidate = () => qc.invalidateQueries({ queryKey: ['catalogo-admin-products'] })

  const openEdit = (p: Product) => {
    setEditing(p)
    setForm({
      price: String(p.price ?? 0),
      precioGremio: p.precioGremio != null ? String(p.precioGremio) : '',
      costo: p.costo != null ? String(p.costo) : '',
      ivaPct: p.ivaPct != null ? String(p.ivaPct) : '',
      supplier: p.supplier ?? '',
      supplierAvailability: p.supplierAvailability ?? '',
      active: p.active ?? true,
    })
  }
  const closeEdit = () => { setEditing(null); setForm(null) }

  const handleSave = async () => {
    if (!editing || !form) return
    setSaving(true)
    try {
      const res = await fetch(`/api/products/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: Number(form.price) || 0,
          precioGremio: form.precioGremio === '' ? null : Number(form.precioGremio),
          costo: form.costo === '' ? null : Number(form.costo),
          ivaPct: form.ivaPct === '' ? null : Number(form.ivaPct),
          supplier: form.supplier || null,
          supplierAvailability: form.supplierAvailability || null,
          active: form.active,
        }),
      })
      if (!res.ok) { toast.error('Error al guardar'); return }
      toast.success('Producto actualizado')
      invalidate()
      closeEdit()
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  // Toggle rápido de baja/alta sin abrir el modal completo — la acción que
  // más se va a usar (dar de baja un SKU puntual) no debería necesitar
  // completar un formulario entero.
  const handleToggleActive = async (p: Product) => {
    setTogglingId(p.id)
    try {
      const res = await fetch(`/api/products/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !p.active }),
      })
      if (!res.ok) { toast.error('Error al actualizar'); return }
      toast.success(p.active ? 'Producto dado de baja — no se vende ni se muestra' : 'Producto reactivado')
      invalidate()
    } catch { toast.error('Error de conexión') } finally { setTogglingId(null) }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/catalogo/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al sincronizar'); return }
      const result: CatalogSyncResult = json.data
      if (!result.ok) { toast.error(result.error ?? 'Error al sincronizar'); return }
      toast.success(`Sincronizado: ${result.processed} productos revisados, ${result.written ?? result.processed} con cambios reales`)
      if (result.skusNotSeenThisRun && result.skusNotSeenThisRun.length > 0) {
        toast(`${result.skusNotSeenThisRun.length} SKUs del catálogo no aparecieron en esta corrida del Sheet — revisalos si corresponde darlos de baja.`, { icon: '⚠️', duration: 6000 })
      }
      invalidate()
    } catch { toast.error('Error de conexión') } finally { setSyncing(false) }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-subtle)' }}>Catálogo del proveedor</h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{total} productos importados — dar de baja oculta uno sin borrarlo, así el sync no lo trae de vuelta solo</p>
      </div>

      <div className="surface rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          {sheetsEnabled ? <CheckCircle size={18} className="text-emerald-500 shrink-0" /> : <XCircle size={18} className="text-[var(--color-text-subtle)] shrink-0" />}
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              Sync con Google Sheets {sheetsEnabled ? 'activado' : 'no activado'}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
              {sheetsEnabled
                ? `Sheet: ${(sheetsConfig?.sheetId as string) ?? '—'} · Última sync de un producto: ${lastSynced ? formatDateTime(lastSynced) : 'todavía ninguna'}`
                : 'Activalo desde Configuración > Plugins para traer el catálogo automáticamente.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!sheetsEnabled && (
            <Link href="/configuracion/plugins">
              <Button variant="outline" size="sm"><Settings2 size={14} className="mr-1.5" />Configurar</Button>
            </Link>
          )}
          <Button size="sm" onClick={handleSync} loading={syncing} disabled={!sheetsEnabled}>
            <RefreshCw size={14} className="mr-1.5" />Sincronizar ahora
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)]" />
        <Input
          placeholder="Buscar por nombre, SKU o marca..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <CatalogFilters
        categories={categories}
        brands={brands}
        categoryId={categoryId}
        onCategoryChange={setCategoryId}
        brand={brand}
        onBrandChange={setBrand}
        className="grid grid-cols-1 sm:grid-cols-4 gap-3"
      />
      <Select
        options={STATUS_OPTIONS}
        value={status}
        onChange={(e) => setStatus(e.target.value as typeof status)}
        className="max-w-[200px]"
      />

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Boxes size={32} className="mb-3 opacity-30" style={{ color: 'var(--color-text-muted)' }} />
          <p className="font-medium" style={{ color: 'var(--color-text-muted)' }}>
            No hay productos {debouncedSearch || categoryId || brand ? 'que coincidan con el filtro' : 'importados todavía'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {products.map((p) => (
            <div key={p.id} className={cn('surface rounded-xl overflow-hidden flex flex-col border', p.active ? 'border-transparent' : 'border-red-500/30 opacity-70')}>
              <div className="aspect-square bg-[var(--color-surface-raised)] flex items-center justify-center overflow-hidden relative">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain p-3" loading="lazy" />
                ) : (
                  <Boxes size={20} className="opacity-20" style={{ color: 'var(--color-text-muted)' }} />
                )}
                <span className={cn(
                  'absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                  p.active ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'
                )}>
                  {p.active ? 'Activo' : 'De baja'}
                </span>
              </div>
              <div className="p-2 flex flex-col gap-1 flex-1">
                <p className="text-xs font-medium leading-snug line-clamp-2 min-h-[2rem]" style={{ color: 'var(--color-text)' }}>{p.name}</p>
                <p className="text-[10px]" style={{ color: 'var(--color-text-subtle)' }}>{p.brand}{p.sku ? ` · ${p.sku}` : ''}</p>
                <div className="flex items-baseline justify-between gap-1 pt-0.5">
                  <span className="text-xs font-bold truncate" style={{ color: 'var(--color-text)' }}>{formatCurrency(p.price, p.currency)}</span>
                  {p.precioGremio != null && <span className="text-[10px] text-emerald-500 shrink-0">Gr. {formatCurrency(p.precioGremio, p.currency)}</span>}
                </div>
                <div className="flex items-center gap-1 mt-auto pt-1">
                  <button onClick={() => openEdit(p)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors hover:bg-[var(--color-surface-raised)]"
                    style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                    <Pencil size={11} /> Editar
                  </button>
                  <button onClick={() => handleToggleActive(p)} disabled={togglingId === p.id}
                    title={p.active ? 'Dar de baja' : 'Reactivar'}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors disabled:opacity-50',
                      p.active ? 'hover:bg-red-500/10 hover:text-red-400' : 'hover:bg-emerald-500/10 hover:text-emerald-500'
                    )}
                    style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                    {p.active ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={setPage} />
      )}

      {editing && form && (
        <Modal open onClose={closeEdit} title={editing.name}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Costo" type="number" step="0.01" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} />
              <Input label="IVA (%)" type="number" step="0.1" value={form.ivaPct} onChange={(e) => setForm({ ...form, ivaPct: e.target.value })} />
              <Input label="Precio Público" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              <Input label="Precio Gremio" type="number" step="0.01" value={form.precioGremio} onChange={(e) => setForm({ ...form, precioGremio: e.target.value })} />
            </div>
            <Input label="Proveedor" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            <Input label="Disponibilidad" value={form.supplierAvailability} onChange={(e) => setForm({ ...form, supplierAvailability: e.target.value })} />
            <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none" style={{ color: 'var(--color-text)' }}>
              <input type="checkbox" className="rounded" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Producto activo (visible en Catálogo, Cotizador y portal Gremio)
            </label>
            <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
              Ojo: si el sync con Google Sheets está activado, la próxima corrida va a pisar estos valores con lo que diga el Sheet (salvo el estado activo/inactivo, que nunca lo toca el sync).
            </p>
            <ModalFooter>
              <Button type="button" variant="ghost" onClick={closeEdit}>Cancelar</Button>
              <Button type="button" loading={saving} onClick={handleSave}>Guardar</Button>
            </ModalFooter>
          </div>
        </Modal>
      )}
    </div>
  )
}
