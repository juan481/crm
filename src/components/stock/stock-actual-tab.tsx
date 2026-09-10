'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, ClipboardList, Package, PackageX, TrendingDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Pagination } from '@/components/ui/table'
import type { Product } from '@/types'
import toast from 'react-hot-toast'

interface StockRow {
  id: string
  name: string
  sku: string | null
  brand: string | null
  unit: string
  stock: number
  stockReservado: number
  disponible: number
  stockMinimo: number | null
  bajoMinimo: boolean
  supplierStock: number | null
  supplierAvailability: string | null
  costo: number | null
  currency: string
  categoria: { id: string; name: string } | null
  ultimoMovimiento: string | null
  diasSinMovimiento: number | null
}

const FILTRO_OPTIONS = [
  { value: '',                    label: 'Todos' },
  { value: 'bajo-minimo',         label: 'Bajo mínimo' },
  { value: 'sin-stock',           label: 'Sin stock' },
  { value: 'sin-movimiento-30',   label: 'Sin movimiento 30+ días' },
  { value: 'sin-movimiento-60',   label: 'Sin movimiento 60+ días' },
  { value: 'sin-movimiento-90',   label: 'Sin movimiento 90+ días' },
]

export function StockActualTab() {
  const qc = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState('')
  const [page, setPage] = useState(1)
  const [movProduct, setMovProduct] = useState<StockRow | null>(null)
  const [conteoOpen, setConteoOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchInput])
  useEffect(() => { setPage(1) }, [filtro])

  const { data, isLoading } = useQuery({
    queryKey: ['stock-actual', search, filtro, page],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: '50', resumen: '0' })
      if (search.length >= 2) p.set('search', search)
      if (filtro) p.set('filtro', filtro)
      const res = await fetch(`/api/stock?${p}`)
      if (!res.ok) throw new Error('Error al cargar')
      return res.json()
    },
    staleTime: 15_000,
  })

  const rows: StockRow[] = data?.data ?? []
  const total: number = data?.total ?? 0
  const totalPages: number = data?.totalPages ?? 1

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ['stock-actual'] })
    qc.invalidateQueries({ queryKey: ['stock-resumen-cards'] })
    qc.invalidateQueries({ queryKey: ['stock-movimientos'] })
    qc.invalidateQueries({ queryKey: ['products'] })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <div className="w-full sm:w-56">
            <Input placeholder="Buscar producto, SKU, marca..." value={searchInput}
              onChange={e => setSearchInput(e.target.value)} leftIcon={<Search size={15} />} />
          </div>
          <div className="w-full sm:w-52">
            <Select options={FILTRO_OPTIONS} value={filtro} onChange={e => setFiltro(e.target.value)} />
          </div>
        </div>
        <Button size="sm" variant="outline" leftIcon={<ClipboardList size={14} />} onClick={() => setConteoOpen(true)}
          className="w-full sm:w-auto shrink-0">
          Cargar conteo inicial
        </Button>
      </div>

      <div className="rounded-2xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Producto</th>
              <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Depósito</th>
              <th className="px-4 py-3 text-right font-semibold hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>Reservado</th>
              <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Disponible</th>
              <th className="px-4 py-3 text-right font-semibold hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>Mínimo</th>
              <th className="px-4 py-3 text-right font-semibold hidden lg:table-cell" style={{ color: 'var(--color-text-muted)' }}>Proveedor</th>
              <th className="px-4 py-3 text-right font-semibold hidden xl:table-cell" style={{ color: 'var(--color-text-muted)' }}>Últ. mov.</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center" style={{ color: 'var(--color-text-muted)' }}>Cargando...</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-14 text-center">
                  <Package size={32} className="mx-auto mb-3 opacity-25" />
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {search || filtro ? 'Sin resultados' : 'Todavía no hay productos con control de stock'}
                  </p>
                  <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: 'var(--color-text-muted)' }}>
                    {search || filtro
                      ? 'Probá con otro filtro o búsqueda.'
                      : 'Marcá "Controlar stock" en un producto (Catálogo → Gestionar) o usá "Cargar conteo inicial".'}
                  </p>
                </td>
              </tr>
            ) : rows.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--color-border)' }}
                className="hover:bg-[var(--color-surface-raised)] transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium" style={{ color: 'var(--color-text)' }}>{r.name}</div>
                  <div className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--color-text-subtle)' }}>
                    {r.sku && <span>{r.sku}</span>}
                    {r.brand && <span>· {r.brand}</span>}
                    {r.categoria && <span>· {r.categoria.name}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text)' }}>
                  {r.stock} <span className="text-[11px] font-normal" style={{ color: 'var(--color-text-subtle)' }}>{r.unit}</span>
                </td>
                <td className="px-4 py-3 text-right hidden sm:table-cell" style={{ color: r.stockReservado > 0 ? 'var(--color-text)' : 'var(--color-text-subtle)' }}>
                  {r.stockReservado || '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-xs"
                    style={{
                      background: r.disponible <= 0 ? 'rgba(239,68,68,0.12)' : r.bajoMinimo ? 'rgba(245,158,11,0.14)' : 'rgba(16,185,129,0.12)',
                      color: r.disponible <= 0 ? '#ef4444' : r.bajoMinimo ? '#f59e0b' : '#10b981',
                    }}>
                    {r.disponible <= 0 ? <PackageX size={11} /> : r.bajoMinimo ? <TrendingDown size={11} /> : null}
                    {r.disponible}
                  </span>
                </td>
                <td className="px-4 py-3 text-right hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>
                  {r.stockMinimo ?? '—'}
                </td>
                <td className="px-4 py-3 text-right hidden lg:table-cell text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {r.supplierStock != null ? `${r.supplierStock}` : (r.supplierAvailability || '—')}
                </td>
                <td className="px-4 py-3 text-right hidden xl:table-cell text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                  {r.ultimoMovimiento
                    ? new Date(r.ultimoMovimiento).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
                    : 'nunca'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setMovProduct(r)}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors hover:bg-[var(--color-primary)]/10"
                    style={{ color: 'var(--color-primary)', border: '1px solid var(--color-border)' }}>
                    Movimiento
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} total={total} limit={50} onPageChange={setPage} />
      )}

      {movProduct && (
        <MovimientoModal
          product={movProduct}
          onClose={() => setMovProduct(null)}
          onDone={() => { refetchAll(); setMovProduct(null) }}
        />
      )}

      {conteoOpen && (
        <ConteoInicialModal onClose={() => setConteoOpen(false)} onDone={() => { refetchAll(); setConteoOpen(false) }} />
      )}
    </div>
  )
}

// ─── Modal: registrar un movimiento manual ───────────────────────────────
function MovimientoModal({ product, onClose, onDone }: { product: StockRow; onClose: () => void; onDone: () => void }) {
  const [tipo, setTipo] = useState<'Entrada' | 'Salida' | 'Ajuste'>('Entrada')
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [signo, setSigno] = useState<1 | -1>(1)
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = Number(cantidad)
    if (!cantidad || isNaN(n) || n <= 0) { toast.error('Ingresá una cantidad válida'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/products/${product.id}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, cantidad: n, motivo: motivo.trim() || null, ...(tipo === 'Ajuste' && { signo }) }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success('Movimiento registrado')
      onDone()
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Movimiento — ${product.name}`} size="sm">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg py-2" style={{ background: 'var(--color-surface-raised)' }}>
            <div style={{ color: 'var(--color-text-subtle)' }}>Depósito</div>
            <div className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{product.stock}</div>
          </div>
          <div className="rounded-lg py-2" style={{ background: 'var(--color-surface-raised)' }}>
            <div style={{ color: 'var(--color-text-subtle)' }}>Reservado</div>
            <div className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{product.stockReservado}</div>
          </div>
          <div className="rounded-lg py-2" style={{ background: 'var(--color-surface-raised)' }}>
            <div style={{ color: 'var(--color-text-subtle)' }}>Disponible</div>
            <div className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{product.disponible}</div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipo" value={tipo} onChange={e => setTipo(e.target.value as typeof tipo)}
              options={[
                { value: 'Entrada', label: 'Entrada (+)' },
                { value: 'Salida', label: 'Salida (−)' },
                { value: 'Ajuste', label: 'Ajuste' },
              ]} />
            <Input label="Cantidad" type="number" min="1" step="1" value={cantidad}
              onChange={e => setCantidad(e.target.value)} placeholder="0" />
          </div>
          {tipo === 'Ajuste' && (
            <div className="flex gap-2">
              <button type="button" onClick={() => setSigno(1)}
                className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
                style={signo === 1
                  ? { background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid #10b981' }
                  : { background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                Sumar
              </button>
              <button type="button" onClick={() => setSigno(-1)}
                className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
                style={signo === -1
                  ? { background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid #ef4444' }
                  : { background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                Restar
              </button>
            </div>
          )}
          <Input label="Motivo (opcional)" value={motivo} onChange={e => setMotivo(e.target.value)}
            placeholder="Ej: compra a proveedor, ajuste de conteo..." />
          <ModalFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={saving}>Registrar</Button>
          </ModalFooter>
        </form>
      </div>
    </Modal>
  )
}

// ─── Modal: conteo inicial masivo ────────────────────────────────────────
function ConteoInicialModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [minimos, setMinimos] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery<{ data: Product[] }>({
    queryKey: ['products', 'simple'],
    queryFn: async () => (await fetch('/api/products?scope=simple')).json(),
    staleTime: 30_000,
  })
  const productos = (data?.data ?? []).filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()))

  const submit = async () => {
    const items = Object.entries(counts)
      .filter(([, v]) => v !== '' && !isNaN(Number(v)) && Number(v) >= 0)
      .map(([productId, v]) => ({
        productId,
        cantidad: Number(v),
        ...(minimos[productId] !== undefined && minimos[productId] !== ''
          ? { stockMinimo: Number(minimos[productId]) }
          : {}),
      }))
    if (items.length === 0) { toast.error('Cargá al menos una cantidad'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/stock/conteo-inicial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      const { aplicados, saltados } = json.data
      toast.success(`${aplicados} producto${aplicados !== 1 ? 's' : ''} actualizado${aplicados !== 1 ? 's' : ''}${saltados ? ` · ${saltados} sin cambios` : ''}`)
      onDone()
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title="Conteo inicial de depósito" size="lg">
      <div className="space-y-3">
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Cargá la cantidad física real de cada producto. El sistema registra el movimiento
          que lleva del stock actual al contado (queda en el historial como conteo inicial).
          Para productos del catálogo del proveedor, usá el botón <strong>Movimiento</strong> en su fila.
        </p>
        <Input placeholder="Filtrar productos..." value={search} onChange={e => setSearch(e.target.value)}
          leftIcon={<Search size={14} />} />

        <div className="rounded-xl overflow-y-auto" style={{ border: '1px solid var(--color-border)', maxHeight: 360 }}>
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--color-surface-raised)', position: 'sticky', top: 0 }}>
              <tr>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Producto</th>
                <th className="px-3 py-2 text-right font-semibold w-24" style={{ color: 'var(--color-text-muted)' }}>Actual</th>
                <th className="px-3 py-2 text-right font-semibold w-28" style={{ color: 'var(--color-text-muted)' }}>Contado</th>
                <th className="px-3 py-2 text-right font-semibold w-28" style={{ color: 'var(--color-text-muted)' }}>Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center" style={{ color: 'var(--color-text-muted)' }}>Cargando...</td></tr>
              ) : productos.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center" style={{ color: 'var(--color-text-muted)' }}>No hay productos propios cargados.</td></tr>
              ) : productos.map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td className="px-3 py-2" style={{ color: 'var(--color-text)' }}>{p.name}</td>
                  <td className="px-3 py-2 text-right" style={{ color: 'var(--color-text-subtle)' }}>{p.trackStock ? p.stock : '—'}</td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" step="1" value={counts[p.id] ?? ''}
                      onChange={e => setCounts(c => ({ ...c, [p.id]: e.target.value }))}
                      className="w-full text-right rounded-lg px-2 py-1 text-sm outline-none"
                      style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" step="1" value={minimos[p.id] ?? ''} placeholder="—"
                      onChange={e => setMinimos(m => ({ ...m, [p.id]: e.target.value }))}
                      className="w-full text-right rounded-lg px-2 py-1 text-sm outline-none"
                      style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} loading={saving}>Guardar conteo</Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}
