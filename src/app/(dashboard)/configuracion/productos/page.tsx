'use client'

import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Plus, ArrowLeft, Pencil, Trash2, Package, Upload, CheckCircle, XCircle, AlertTriangle, Boxes, ArrowDownCircle, ArrowUpCircle, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import type { Product } from '@/types'
import toast from 'react-hot-toast'

interface CsvRow { name: string; description: string; price: string; currency: string; unit: string; valid: boolean; error?: string }

function normalizeHeader(h: string): string {
  return h.trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // strip accents: é→e, ó→o, etc.
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

function splitCsvLine(line: string): string[] {
  const cols: string[] = []
  let cur = '', inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      cols.push(cur.trim()); cur = ''
    } else {
      cur += ch
    }
  }
  cols.push(cur.trim())
  return cols
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = splitCsvLine(lines[0]).map(normalizeHeader)
  const idx = (k: string) => headers.indexOf(k)
  const nameIdx  = idx('nombre') !== -1 ? idx('nombre') : idx('name') !== -1 ? idx('name') : 0
  const descIdx  = idx('descripcion') !== -1 ? idx('descripcion') : idx('description') !== -1 ? idx('description') : -1
  const priceIdx = idx('precio') !== -1 ? idx('precio') : idx('price') !== -1 ? idx('price') : -1
  const currIdx  = idx('moneda') !== -1 ? idx('moneda') : idx('currency') !== -1 ? idx('currency') : -1
  const unitIdx  = idx('unidad') !== -1 ? idx('unidad') : idx('unit') !== -1 ? idx('unit') : -1

  return lines.slice(1).map(line => {
    const cols  = splitCsvLine(line)
    const name  = cols[nameIdx]  ?? ''
    const price = priceIdx !== -1 ? (cols[priceIdx] ?? '') : ''
    const currencyRaw = currIdx !== -1 ? (cols[currIdx] || 'USD') : 'USD'
    // Antes cualquier texto no vacío en la columna moneda/currency pasaba
    // sin validar (sólo se completaba "USD" si la celda venía vacía) — el
    // alta manual sí está acotada a un <select> fijo, pero por acá se
    // colaba cualquier cosa, y un producto con una moneda inválida rompía
    // Intl.NumberFormat (con un error genérico) en cualquier pantalla que
    // después mostrara su precio: Cotizador, este mismo catálogo,
    // cotizaciones ya guardadas. Ver también la validación server-side en
    // /api/products (segunda barrera, por si se postea directo a la API).
    const currency = currencyRaw.trim().toUpperCase()
    const error = !name.trim() ? 'Nombre vacío'
      : (isNaN(Number(price)) || price === '') ? 'Precio inválido'
      : !VALID_CURRENCIES.has(currency) ? `Moneda inválida: "${currencyRaw}" (usá USD, ARS o EUR)`
      : undefined
    return {
      name,
      description: descIdx !== -1 ? (cols[descIdx] ?? '') : '',
      price,
      currency,
      unit:        unitIdx !== -1 ? (cols[unitIdx] || 'unidad') : 'unidad',
      valid:       !error,
      error,
    }
  })
}

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD — Dólar' },
  { value: 'ARS', label: 'ARS — Peso arg.' },
  { value: 'EUR', label: 'EUR — Euro' },
]
const VALID_CURRENCIES = new Set(CURRENCY_OPTIONS.map(o => o.value))

const EMPTY_FORM = { name: '', description: '', price: '', currency: 'USD', unit: 'unidad', trackStock: false }

const TIPO_MOVIMIENTO_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  Entrada: { label: 'Entrada', icon: <ArrowUpCircle size={13} />, color: '#10b981' },
  Salida:  { label: 'Salida',  icon: <ArrowDownCircle size={13} />, color: '#ef4444' },
  Ajuste:  { label: 'Ajuste',  icon: <SlidersHorizontal size={13} />, color: '#f59e0b' },
}

interface StockMovimiento {
  id: string; tipo: string; cantidad: number; stockResultante: number
  motivo: string | null; createdAt: string
}

export default function ProductosPage() {
  const router = useRouter()
  const qc     = useQueryClient()
  const { user } = useAuthStore()

  const [showModal,    setShowModal]    = useState(false)
  const [editing,      setEditing]      = useState<Product | null>(null)
  const [deleteId,     setDeleteId]     = useState<string | null>(null)
  const [form,         setForm]         = useState(EMPTY_FORM)
  const [saving,       setSaving]       = useState(false)
  const [deleting,     setDeleting]     = useState(false)
  const [csvRows,      setCsvRows]      = useState<CsvRow[]>([])
  const [showImport,   setShowImport]   = useState(false)
  const [importing,    setImporting]    = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Stock — modal aparte, no reusa showModal/form de arriba (ese es el
  // form de alta/edición del producto en sí).
  const [stockProduct, setStockProduct] = useState<Product | null>(null)
  const [stockTipo,    setStockTipo]    = useState<'Entrada' | 'Salida' | 'Ajuste'>('Entrada')
  const [stockCantidad, setStockCantidad] = useState('')
  const [stockMotivo,  setStockMotivo]  = useState('')
  // Sólo aplica cuando stockTipo === 'Ajuste' — Entrada y Salida ya tienen
  // signo implícito. Bug real encontrado en revisión: el Select de tipo
  // decía "Ajuste (+)" pero nunca mandaba un signo al server, así que un
  // Ajuste sólo podía sumar — no había forma de corregir el stock hacia
  // abajo salvo fingiendo una "Salida".
  const [stockSigno,   setStockSigno]   = useState<1 | -1>(1)
  const [stockSaving,  setStockSaving]  = useState(false)

  const { data: stockData, isLoading: stockLoading } = useQuery<{ data: { stock: number; trackStock: boolean; movimientos: StockMovimiento[] } }>({
    queryKey: ['product-stock', stockProduct?.id],
    queryFn: async () => (await fetch(`/api/products/${stockProduct!.id}/stock`)).json(),
    enabled: !!stockProduct,
  })

  const openStock = (p: Product) => { setStockProduct(p); setStockTipo('Entrada'); setStockCantidad(''); setStockMotivo(''); setStockSigno(1) }
  const closeStock = () => setStockProduct(null)

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stockProduct) return
    const cantidadNum = Number(stockCantidad)
    if (!stockCantidad || isNaN(cantidadNum) || cantidadNum <= 0) { toast.error('Ingresá una cantidad válida'); return }
    setStockSaving(true)
    try {
      const res = await fetch(`/api/products/${stockProduct.id}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: stockTipo, cantidad: cantidadNum, motivo: stockMotivo.trim() || null,
          ...(stockTipo === 'Ajuste' && { signo: stockSigno }),
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success('Stock actualizado')
      setStockCantidad(''); setStockMotivo('')
      qc.invalidateQueries({ queryKey: ['product-stock', stockProduct.id] })
      qc.invalidateQueries({ queryKey: ['products'] })
    } catch { toast.error('Error de conexión') } finally { setStockSaving(false) }
  }

  const { data, isLoading, isError } = useQuery<{ data: Product[] }>({
    queryKey: ['products'],
    queryFn:  async () => (await fetch('/api/products')).json(),
    staleTime: 30_000,
  })
  const products = data?.data ?? []

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true) }
  const openEdit   = (p: Product) => {
    setEditing(p)
    setForm({ name: p.name, description: p.description ?? '', price: String(p.price), currency: p.currency, unit: p.unit, trackStock: p.trackStock })
    setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(EMPTY_FORM) }

  const canManage = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const rows = parseCsv(ev.target?.result as string)
      if (!rows.length) { toast.error('El archivo no contiene filas válidas'); return }
      setCsvRows(rows)
      setShowImport(true)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleImport = async () => {
    const valid = csvRows.filter(r => r.valid)
    if (!valid.length) { toast.error('No hay filas válidas para importar'); return }
    setImporting(true)
    let ok = 0
    let fail = 0
    for (const row of valid) {
      try {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: row.name, description: row.description || null, price: Number(row.price), currency: row.currency, unit: row.unit }),
        })
        if (res.ok) ok++; else fail++
      } catch { fail++ }
    }
    setImporting(false)
    qc.invalidateQueries({ queryKey: ['products'] })
    setShowImport(false)
    setCsvRows([])
    toast.success(`${ok} producto${ok !== 1 ? 's' : ''} importado${ok !== 1 ? 's' : ''}${fail ? ` · ${fail} fallaron` : ''}`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim())        { toast.error('El nombre es requerido'); return }
    if (!form.price || isNaN(Number(form.price))) { toast.error('Precio inválido'); return }

    setSaving(true)
    try {
      const body = {
        name:        form.name.trim(),
        description: form.description.trim() || null,
        price:       Number(form.price),
        currency:    form.currency,
        unit:        form.unit.trim() || 'unidad',
        trackStock:  form.trackStock,
      }
      const url    = editing ? `/api/products/${editing.id}` : '/api/products'
      const method = editing ? 'PATCH' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json   = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success(editing ? 'Producto actualizado' : 'Producto creado')
      qc.invalidateQueries({ queryKey: ['products'] })
      closeModal()
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res  = await fetch(`/api/products/${deleteId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success('Producto eliminado')
      qc.invalidateQueries({ queryKey: ['products'] })
      setDeleteId(null)
    } catch { toast.error('Error de conexión') } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/configuracion')}
            className="p-2 rounded-lg hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-text-muted)' }}>
            <ArrowLeft size={18} />
          </button>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-primary)' }}>
            <Package size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Productos</h1>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Catálogo de productos físicos para cotizaciones
            </p>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
            <Button variant="outline" leftIcon={<Upload size={15} />} onClick={() => fileRef.current?.click()}>
              Importar CSV
            </Button>
            <Button leftIcon={<Plus size={15} />} onClick={openCreate}>
              Nuevo Producto
            </Button>
          </div>
        )}
      </div>

      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          <AlertTriangle size={16} />
          Error al cargar los datos. Intentá de nuevo.
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Nombre</th>
              <th className="px-4 py-3 text-left font-semibold hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>Descripción</th>
              <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>Unidad</th>
              <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Precio</th>
              <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Stock</th>
              {canManage && <th className="px-4 py-3 w-20" />}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>Cargando...</td></tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <Package size={32} className="mx-auto mb-3" style={{ color: 'var(--color-text-subtle)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>No hay productos aún</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>Agregá productos físicos como cámaras, kits de instalación, etc.</p>
                </td>
              </tr>
            ) : products.map(p => (
              <tr key={p.id} style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                className="hover:bg-[var(--color-surface-raised)] transition-colors">
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(99,102,241,0.1)' }}>
                      <Package size={13} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    {p.name}
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>
                  {p.description ?? <span style={{ color: 'var(--color-text-subtle)' }}>—</span>}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                    {p.unit}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--color-text)' }}>
                  {formatCurrency(p.price, p.currency)}
                </td>
                <td className="px-4 py-3 text-right">
                  {p.trackStock ? (
                    <button
                      onClick={() => openStock(p)}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full transition-opacity hover:opacity-80"
                      style={{
                        background: p.stock === 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                        color: p.stock === 0 ? '#ef4444' : '#10b981',
                      }}
                      title="Ver/ajustar stock"
                    >
                      <Boxes size={12} /> {p.stock}
                    </button>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>—</span>
                  )}
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(p)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
                        style={{ color: 'var(--color-text-muted)' }}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleteId(p.id)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-400"
                        style={{ color: 'var(--color-text-muted)' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={closeModal} title={editing ? 'Editar Producto' : 'Nuevo Producto'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre *"
            placeholder="Ej: Cámara IP 4MP, Kit de instalación"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Descripción</label>
            <textarea
              rows={2}
              placeholder="Características del producto..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all"
              style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Precio *"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            />
            <Select
              label="Moneda"
              options={CURRENCY_OPTIONS}
              value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
            />
          </div>
          <Input
            label="Unidad"
            placeholder="unidad, cámara, kit, metro, hora..."
            value={form.unit}
            onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
          />
          <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none" style={{ color: 'var(--color-text)' }}>
            <input
              type="checkbox"
              className="rounded"
              checked={form.trackStock}
              onChange={e => setForm(f => ({ ...f, trackStock: e.target.checked }))}
            />
            Controlar stock de este producto
          </label>
          <ModalFooter>
            <Button type="button" variant="ghost" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={saving}>{editing ? 'Guardar' : 'Crear Producto'}</Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar Producto" size="sm">
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          ¿Seguro que querés eliminar este producto? Esta acción no se puede deshacer.
        </p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>Eliminar</Button>
        </ModalFooter>
      </Modal>

      {/* Stock: ajuste manual + historial */}
      <Modal open={!!stockProduct} onClose={closeStock} title={`Stock — ${stockProduct?.name ?? ''}`} size="md">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--color-surface-raised)' }}>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Stock actual</span>
            <span className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
              {stockData?.data.stock ?? stockProduct?.stock ?? 0} {stockProduct?.unit}
            </span>
          </div>

          <form onSubmit={handleStockSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Tipo de movimiento"
                options={[
                  { value: 'Entrada', label: 'Entrada (+)' },
                  { value: 'Salida',  label: 'Salida (−)' },
                  { value: 'Ajuste',  label: 'Ajuste' },
                ]}
                value={stockTipo}
                onChange={e => setStockTipo(e.target.value as typeof stockTipo)}
              />
              <Input
                label="Cantidad"
                type="number"
                min="1"
                step="1"
                placeholder="0"
                value={stockCantidad}
                onChange={e => setStockCantidad(e.target.value)}
              />
            </div>
            {stockTipo === 'Ajuste' && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStockSigno(1)}
                  className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
                  style={stockSigno === 1
                    ? { background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid #10b981' }
                    : { background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
                >
                  Sumar al stock
                </button>
                <button
                  type="button"
                  onClick={() => setStockSigno(-1)}
                  className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
                  style={stockSigno === -1
                    ? { background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid #ef4444' }
                    : { background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
                >
                  Restar del stock
                </button>
              </div>
            )}
            <Input
              label="Motivo (opcional)"
              placeholder="Ej: compra a proveedor, instalación en cliente X..."
              value={stockMotivo}
              onChange={e => setStockMotivo(e.target.value)}
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" loading={stockSaving}>Registrar movimiento</Button>
            </div>
          </form>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-subtle)' }}>Historial</p>
            {stockLoading ? (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
            ) : !stockData?.data.movimientos.length ? (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>Todavía no hay movimientos.</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {stockData.data.movimientos.map(m => {
                  const meta = TIPO_MOVIMIENTO_META[m.tipo] ?? TIPO_MOVIMIENTO_META.Ajuste
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--color-surface-raised)' }}>
                      <span style={{ color: meta.color }}>{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                          {meta.label} de {m.cantidad} — quedó en {m.stockResultante}
                        </p>
                        {m.motivo && <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{m.motivo}</p>}
                      </div>
                      <span className="text-xs shrink-0" style={{ color: 'var(--color-text-subtle)' }}>
                        {new Date(m.createdAt).toLocaleDateString('es-AR')}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* CSV Import preview */}
      <Modal open={showImport} onClose={() => { setShowImport(false); setCsvRows([]) }} title="Vista previa de importación" size="lg">
        <div className="mb-3 flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          <span className="font-medium" style={{ color: 'var(--color-text)' }}>{csvRows.length}</span> filas detectadas ·&nbsp;
          <span style={{ color: '#10b981' }}><strong>{csvRows.filter(r => r.valid).length}</strong> válidas</span>
          {csvRows.some(r => !r.valid) && (
            <span style={{ color: '#ef4444' }}> · <strong>{csvRows.filter(r => !r.valid).length}</strong> con error</span>
          )}
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-subtle)' }}>
          Columnas esperadas: <strong>nombre, descripcion, precio, moneda, unidad</strong> (o en inglés: name, description, price, currency, unit)
        </p>
        <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--color-border)', maxHeight: 320, overflowY: 'auto' }}>
          <table className="w-full text-xs">
            <thead style={{ background: 'var(--color-surface-raised)', position: 'sticky', top: 0 }}>
              <tr>
                {['', 'Nombre', 'Descripción', 'Precio', 'Moneda', 'Unidad'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {csvRows.map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--color-border)', background: row.valid ? undefined : 'rgba(239,68,68,0.04)' }}>
                  <td className="px-3 py-2">
                    {row.valid
                      ? <CheckCircle size={13} style={{ color: '#10b981' }} />
                      : <span title={row.error}><XCircle size={13} style={{ color: '#ef4444' }} /></span>}
                  </td>
                  <td className="px-3 py-2 font-medium" style={{ color: 'var(--color-text)' }}>{row.name || <em style={{ color: 'var(--color-text-subtle)' }}>—</em>}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--color-text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description || '—'}</td>
                  <td className="px-3 py-2" style={{ color: row.valid ? 'var(--color-text)' : '#ef4444' }}>{row.price}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>{row.currency}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>{row.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ModalFooter className="mt-4">
          <Button variant="ghost" onClick={() => { setShowImport(false); setCsvRows([]) }}>Cancelar</Button>
          <Button
            onClick={handleImport}
            loading={importing}
            disabled={!csvRows.some(r => r.valid)}
          >
            Importar {csvRows.filter(r => r.valid).length} productos
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
