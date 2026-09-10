'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Search, ArrowUpCircle, ArrowDownCircle, SlidersHorizontal, History, FileDown, ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/table'
import { exportToExcel } from '@/lib/xlsx-export'
import toast from 'react-hot-toast'

interface Movimiento {
  id: string
  tipo: string
  cantidad: number
  stockResultante: number
  motivo: string | null
  origen: string
  numeroComprobante: string | null
  costoUnitario: number | null
  createdAt: string
  creadoPor: string | null
  compraId: string | null
  entregaId: string | null
  dealId: string | null
  product: { id: string; name: string; sku: string | null; unit: string } | null
}

const ORIGEN_OPTIONS = [
  { value: '',        label: 'Todos los orígenes' },
  { value: 'MANUAL',  label: 'Manual' },
  { value: 'INICIAL', label: 'Conteo inicial' },
  { value: 'COMPRA',  label: 'Compra' },
  { value: 'VENTA',   label: 'Venta / obra' },
  { value: 'AJUSTE',  label: 'Ajuste' },
]

const TIPO_META: Record<string, { icon: React.ReactNode; color: string }> = {
  Entrada: { icon: <ArrowUpCircle size={13} />, color: '#10b981' },
  Salida:  { icon: <ArrowDownCircle size={13} />, color: '#ef4444' },
  Ajuste:  { icon: <SlidersHorizontal size={13} />, color: '#f59e0b' },
}

const ORIGEN_LABEL: Record<string, string> = {
  MANUAL: 'Manual', INICIAL: 'Conteo inicial', COMPRA: 'Compra', VENTA: 'Venta / obra', AJUSTE: 'Ajuste',
}

export function MovimientosTab() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [origen, setOrigen] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchInput])
  useEffect(() => { setPage(1) }, [origen, desde, hasta])

  const { data, isLoading } = useQuery({
    queryKey: ['stock-movimientos', search, origen, desde, hasta, page],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: '50' })
      if (search.length >= 2) p.set('search', search)
      if (origen) p.set('origen', origen)
      if (desde) p.set('desde', desde)
      if (hasta) p.set('hasta', hasta)
      const res = await fetch(`/api/stock/movimientos?${p}`)
      if (!res.ok) throw new Error('Error al cargar')
      return res.json()
    },
    staleTime: 15_000,
  })

  const rows: Movimiento[] = data?.data ?? []
  const total: number = data?.total ?? 0
  const totalPages: number = data?.totalPages ?? 1
  const [exporting, setExporting] = useState(false)

  const exportar = async () => {
    setExporting(true)
    try {
      const p = new URLSearchParams({ page: '1', limit: '5000' })
      if (search.length >= 2) p.set('search', search)
      if (origen) p.set('origen', origen)
      if (desde) p.set('desde', desde)
      if (hasta) p.set('hasta', hasta)
      const res = await fetch(`/api/stock/movimientos?${p}`)
      const json = await res.json()
      const all: Movimiento[] = json.data ?? []
      if (all.length === 0) { toast.error('No hay movimientos para exportar'); return }
      await exportToExcel(
        `movimientos-stock-${new Date().toISOString().slice(0, 10)}.xlsx`,
        'Movimientos',
        all.map((m) => ({
          Fecha: new Date(m.createdAt).toLocaleString('es-AR'),
          Producto: m.product?.name ?? '',
          SKU: m.product?.sku ?? '',
          Tipo: m.tipo,
          Cantidad: m.cantidad,
          'Stock resultante': m.stockResultante,
          Origen: ORIGEN_LABEL[m.origen] ?? m.origen,
          Comprobante: m.numeroComprobante ?? '',
          Motivo: m.motivo ?? '',
          'Costo unitario': m.costoUnitario ?? '',
          Quién: m.creadoPor ?? '',
        })),
      )
      toast.success(`${all.length} movimiento${all.length !== 1 ? 's' : ''} exportado${all.length !== 1 ? 's' : ''}`)
    } catch { toast.error('Error al exportar') } finally { setExporting(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2 flex-wrap">
        <div className="w-full sm:w-56">
          <Input placeholder="Producto, motivo, comprobante..." value={searchInput}
            onChange={e => setSearchInput(e.target.value)} leftIcon={<Search size={15} />} />
        </div>
        <div className="w-full sm:w-48">
          <Select options={ORIGEN_OPTIONS} value={origen} onChange={e => setOrigen(e.target.value)} />
        </div>
        <div className="flex-1 sm:flex-none min-w-[130px]">
          <label className="block text-[11px] mb-1" style={{ color: 'var(--color-text-muted)' }}>Desde</label>
          <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        </div>
        <div className="flex-1 sm:flex-none min-w-[130px]">
          <label className="block text-[11px] mb-1" style={{ color: 'var(--color-text-muted)' }}>Hasta</label>
          <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
        </div>
        {(origen || desde || hasta || search) && (
          <button onClick={() => { setSearchInput(''); setSearch(''); setOrigen(''); setDesde(''); setHasta('') }}
            className="text-xs px-2 py-2" style={{ color: 'var(--color-primary)' }}>
            Limpiar
          </button>
        )}
        <Button size="sm" variant="outline" onClick={exportar} loading={exporting} leftIcon={<FileDown size={14} />}>
          Excel
        </Button>
      </div>

      <div className="rounded-2xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Fecha</th>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Producto</th>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Movimiento</th>
              <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Resultante</th>
              <th className="px-4 py-3 text-left font-semibold hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>Origen</th>
              <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell" style={{ color: 'var(--color-text-muted)' }}>Detalle</th>
              <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell" style={{ color: 'var(--color-text-muted)' }}>Quién</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center" style={{ color: 'var(--color-text-muted)' }}>Cargando...</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center">
                  <History size={32} className="mx-auto mb-3 opacity-25" />
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>Sin movimientos</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    Los movimientos de stock (entradas, salidas y ajustes) aparecen acá y no se pueden editar.
                  </p>
                </td>
              </tr>
            ) : rows.map(m => {
              const meta = TIPO_META[m.tipo] ?? TIPO_META.Ajuste
              return (
                <tr key={m.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(m.createdAt).toLocaleString('es-AR', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: 'var(--color-text)' }}>{m.product?.name ?? '—'}</div>
                    {m.product?.sku && <div className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>{m.product.sku}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 font-medium" style={{ color: meta.color }}>
                      {meta.icon} {m.tipo} {m.cantidad}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text)' }}>{m.stockResultante}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {ORIGEN_LABEL[m.origen] ?? m.origen}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {m.compraId ? (
                      <Link href="/compras" className="inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--color-primary)' }}>
                        {m.numeroComprobante || 'Compra'} <ExternalLink size={10} />
                      </Link>
                    ) : m.entregaId ? (
                      <Link href={`/entregas?id=${m.entregaId}`} className="inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--color-primary)' }}>
                        {m.motivo || 'Entrega'} <ExternalLink size={10} />
                      </Link>
                    ) : (
                      m.numeroComprobante || m.motivo || '—'
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {m.creadoPor ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} total={total} limit={50} onPageChange={setPage} />
      )}
    </div>
  )
}
