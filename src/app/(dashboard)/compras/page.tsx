'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ShoppingCart, Upload, Plus, AlertTriangle, FileText, Camera, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Pagination } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { useModuleAccess } from '@/hooks/use-module-access'
import { formatMoneyExact } from '@/lib/utils'
import { CompraForm, type OcrSeed } from '@/components/compras/compra-form'
import { CompraDetail } from '@/components/compras/compra-detail'
import { CuentasPorPagar } from '@/components/compras/cuentas-por-pagar'
import toast from 'react-hot-toast'

const ESTADO_OPTS = [
  { value: '', label: 'Todos los estados' },
  { value: 'BORRADOR', label: 'Borrador' },
  { value: 'CONFIRMADA', label: 'Confirmada' },
  { value: 'ANULADA', label: 'Anulada' },
]
const ESTADO_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  BORRADOR:   { label: 'Borrador',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  CONFIRMADA: { label: 'Confirmada', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  ANULADA:    { label: 'Anulada',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}
const PAGO_BADGE: Record<string, { label: string; color: string }> = {
  PENDIENTE: { label: 'A pagar', color: '#ef4444' },
  PARCIAL:   { label: 'Parcial', color: '#f59e0b' },
  PAGADA:    { label: 'Pagada',  color: '#10b981' },
}

export default function ComprasPage() {
  const qc = useQueryClient()
  const allowed = useModuleAccess('compras')
  const fileRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<'LISTA' | 'PAGAR'>('LISTA')
  const [estado, setEstado] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [seed, setSeed] = useState<OcrSeed | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchInput])
  useEffect(() => { setPage(1) }, [estado])

  const { data, isLoading } = useQuery({
    queryKey: ['compras', estado, search, page],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: '30' })
      if (estado) p.set('estado', estado)
      if (search.length >= 2) p.set('search', search)
      const res = await fetch(`/api/compras?${p}`)
      if (!res.ok) throw new Error('Error al cargar')
      return res.json()
    },
    enabled: allowed === true,
    staleTime: 15_000,
  })

  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const refetchList = () => {
    qc.invalidateQueries({ queryKey: ['compras'] })
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setOcrLoading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/compras/ocr', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) {
        // Aún con error de OCR, si dejó el documento adjunto, abrimos el form vacío.
        if (json.documentoId) {
          toast(json.error ?? 'No se pudo leer — cargá los datos a mano', { icon: '📝' })
          setSeed({ documentoId: json.documentoId, documentUrl: json.documentUrl ?? null, ocr: emptyOcr(), proveedorSugerido: null, items: [] })
          setFormOpen(true)
          return
        }
        toast.error(json.error ?? 'Error al procesar la factura')
        return
      }
      setSeed(json.data)
      setFormOpen(true)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setOcrLoading(false)
    }
  }

  if (allowed === undefined) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
  }
  if (allowed === false) {
    return (
      <div className="surface rounded-2xl p-6 flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
        <AlertTriangle size={16} className="text-amber-500" />
        No tenés permiso para ver Compras. Pedile a un administrador que te habilite &quot;Depósito · Compras&quot; en Configuración → Permisos.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl surface flex items-center justify-center shrink-0">
            <ShoppingCart size={18} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Compras</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Facturas de proveedores. Sacale una foto y el CRM la lee, ingresa el stock y avisa si cambió un costo.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={handleFile} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={ocrLoading}
            leftIcon={ocrLoading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}>
            {ocrLoading ? 'Leyendo factura...' : 'Cargar factura (foto/PDF)'}
          </Button>
          <Button onClick={() => { setSeed(null); setFormOpen(true) }} leftIcon={<Plus size={15} />}>
            Carga manual
          </Button>
        </div>
      </div>

      <div className="flex rounded-xl overflow-hidden p-0.5 w-fit"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
        {([
          { t: 'LISTA' as const, label: 'Compras' },
          { t: 'PAGAR' as const, label: 'Por pagar' },
        ]).map((x) => (
          <button key={x.t} onClick={() => setTab(x.t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === x.t ? 'gradient-bg text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}>
            {x.label}
          </button>
        ))}
      </div>

      {tab === 'PAGAR' ? (
        <CuentasPorPagar onChanged={refetchList} />
      ) : (
      <>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-52"><Input placeholder="Buscar por proveedor, N°..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} /></div>
        <div className="w-48"><Select value={estado} onChange={(e) => setEstado(e.target.value)} options={ESTADO_OPTS} /></div>
      </div>

      <div className="rounded-2xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Proveedor</th>
              <th className="px-4 py-3 text-left font-semibold hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>Comprobante</th>
              <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>Fecha</th>
              <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Total</th>
              <th className="px-4 py-3 text-center font-semibold" style={{ color: 'var(--color-text-muted)' }}>Estado</th>
              <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell" style={{ color: 'var(--color-text-muted)' }}>Vence</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center" style={{ color: 'var(--color-text-muted)' }}>Cargando...</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center">
                  <FileText size={32} className="mx-auto mb-3 opacity-25" />
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>{estado || search ? 'Sin resultados' : 'Todavía no cargaste ninguna compra'}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Sacale una foto a una factura de proveedor para empezar.</p>
                </td>
              </tr>
            ) : rows.map((c: any) => {
              const eb = ESTADO_BADGE[c.estado] ?? ESTADO_BADGE.BORRADOR
              const pb = PAGO_BADGE[c.estadoPago] ?? PAGO_BADGE.PENDIENTE
              const venceVencido = c.vencimiento && c.estado === 'CONFIRMADA' && c.estadoPago !== 'PAGADA' && new Date(c.vencimiento) < new Date()
              return (
                <tr key={c.id} onClick={() => setDetailId(c.id)}
                  className="cursor-pointer transition-colors hover:bg-[var(--color-surface-raised)]" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: 'var(--color-text)' }}>{c.proveedor?.name ?? <span style={{ color: 'var(--color-text-subtle)' }}>Sin proveedor</span>}</div>
                    <div className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>{c.itemsCount} ítem{c.itemsCount !== 1 ? 's' : ''}{c.numero ? ` · #${c.numero}` : ''}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {[c.tipoComprobante?.replace('_', ' '), c.numeroComprobante].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(c.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text)' }}>
                    {formatMoneyExact(c.total, c.moneda)}
                    <span className="text-[10px] font-normal ml-0.5" style={{ color: 'var(--color-text-subtle)' }}>{c.moneda}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: eb.bg, color: eb.color }}>{eb.label}</span>
                    {c.estado === 'CONFIRMADA' && (
                      <div className="text-[10px] mt-0.5 font-medium" style={{ color: pb.color }}>{pb.label}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs" style={{ color: venceVencido ? '#ef4444' : 'var(--color-text-muted)' }}>
                    {c.vencimiento ? new Date(c.vencimiento).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : '—'}
                    {venceVencido ? ' ⚠' : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} total={total} limit={30} onPageChange={setPage} />}
      </>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={seed ? 'Revisar factura de compra' : 'Nueva compra'} size="xl">
        {formOpen && <CompraForm seed={seed} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); setSeed(null); refetchList() }} />}
      </Modal>

      <Modal open={!!detailId} onClose={() => setDetailId(null)} title="Compra" size="lg">
        {detailId && <CompraDetail compraId={detailId} onChanged={refetchList} />}
      </Modal>
    </div>
  )
}

function emptyOcr() {
  return {
    proveedorNombre: null, proveedorCuit: null, numeroComprobante: null, tipoComprobante: null,
    fecha: null, moneda: null, subtotal: null, iva: null, total: null,
  }
}
