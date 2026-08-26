'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, RefreshCw, Boxes, CheckCircle, XCircle, Pencil, Settings2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Pagination } from '@/components/ui/table'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { usePlugin } from '@/hooks/use-plugin'
import type { Product } from '@/types'
import type { CatalogSyncResult } from '@/lib/catalogo-sync'
import toast from 'react-hot-toast'

const LIMIT = 20

interface EditForm {
  price: string
  precioGremio: string
  costo: string
  ivaPct: string
  supplier: string
  supplierAvailability: string
  active: boolean
}

export default function CatalogoAdminPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const { enabled: sheetsEnabled, config: sheetsConfig } = usePlugin('catalogo-google-sheets')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['catalogo-admin-products', debouncedSearch, page],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (debouncedSearch.length >= 2) p.set('q', debouncedSearch)
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
      qc.invalidateQueries({ queryKey: ['catalogo-admin-products'] })
      closeEdit()
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
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
      qc.invalidateQueries({ queryKey: ['catalogo-admin-products'] })
    } catch { toast.error('Error de conexión') } finally { setSyncing(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/configuracion')} className="p-2 rounded-lg hover:bg-[var(--color-surface-raised)] transition-colors">
          <ArrowLeft size={18} style={{ color: 'var(--color-text-muted)' }} />
        </button>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Catálogo · Administración</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {total} productos importados del proveedor
          </p>
        </div>
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
          className="pl-9 max-w-sm"
        />
      </div>

      <div className="surface rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-subtle)' }}></th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-subtle)' }}>Producto</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-subtle)' }}>Marca</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-subtle)' }}>Costo</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-subtle)' }}>Público</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-subtle)' }}>Gremio</th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-subtle)' }}>Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center" style={{ color: 'var(--color-text-muted)' }}>Cargando...</td></tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center" style={{ color: 'var(--color-text-muted)' }}>
                    <Boxes size={28} className="mx-auto mb-2 opacity-30" />
                    No hay productos {debouncedSearch ? 'que coincidan con la búsqueda' : 'importados todavía'}
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-4 py-2.5">
                      <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-raised)] flex items-center justify-center overflow-hidden shrink-0">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <Boxes size={16} className="opacity-30" style={{ color: 'var(--color-text-muted)' }} />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium truncate max-w-xs" style={{ color: 'var(--color-text)' }}>{p.name}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{p.sku}</p>
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--color-text-muted)' }}>{p.brand ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right" style={{ color: 'var(--color-text-muted)' }}>{p.costo != null ? formatCurrency(p.costo, p.currency) : '—'}</td>
                    <td className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-text)' }}>{formatCurrency(p.price, p.currency)}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-500 font-medium">{p.precioGremio != null ? formatCurrency(p.precioGremio, p.currency) : '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400'}`}>
                        {p.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-raised)] transition-colors">
                        <Pencil size={14} style={{ color: 'var(--color-text-muted)' }} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
