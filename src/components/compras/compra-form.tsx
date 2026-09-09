'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2, Search, Link2, Unlink, FileText, AlertTriangle, ArrowUp, ArrowDown, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { ModalFooter } from '@/components/ui/modal'
import { formatMoneyExact } from '@/lib/utils'
import toast from 'react-hot-toast'

export interface OcrSeed {
  documentoId: string | null
  documentUrl: string | null
  ocr: {
    proveedorNombre: string | null
    proveedorCuit: string | null
    numeroComprobante: string | null
    tipoComprobante: string | null
    fecha: string | null
    moneda: string | null
    subtotal: number | null
    iva: number | null
    total: number | null
  }
  proveedorSugerido: { id: string; name: string } | null
  items: {
    codigo: string | null
    descripcion: string
    cantidad: number
    precioUnitario: number
    subtotal: number | null
    match: {
      productId: string | null
      confianza: 'ALTA' | 'MEDIA' | 'BAJA' | 'NINGUNA'
      motivo: string
      productName: string | null
      productSku: string | null
      costoActual: number | null
      trackStock: boolean
    }
  }[]
}

interface ItemRow {
  key: string
  productId: string | null
  productName: string | null
  productSku: string | null
  costoActual: number | null
  trackStock: boolean
  matchMotivo: string | null
  sku: string
  nombre: string
  cantidad: string
  costoUnitario: string
}

const TIPO_COMPROBANTE_OPTS = [
  { value: '', label: '— Tipo —' },
  { value: 'FACTURA_A', label: 'Factura A' },
  { value: 'FACTURA_B', label: 'Factura B' },
  { value: 'FACTURA_C', label: 'Factura C' },
  { value: 'REMITO', label: 'Remito' },
  { value: 'TICKET', label: 'Ticket' },
  { value: 'OTRO', label: 'Otro' },
]
const MONEDA_OPTS = [
  { value: 'ARS', label: 'ARS' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
]

let keySeq = 0
const newKey = () => `it-${keySeq++}-${Math.random().toString(36).slice(2, 6)}`

function emptyRow(): ItemRow {
  return {
    key: newKey(), productId: null, productName: null, productSku: null, costoActual: null,
    trackStock: false, matchMotivo: null, sku: '', nombre: '', cantidad: '1', costoUnitario: '',
  }
}

interface Props {
  seed?: OcrSeed | null
  onClose: () => void
  onSaved: () => void
}

export function CompraForm({ seed, onClose, onSaved }: Props) {
  const [proveedorId, setProveedorId] = useState(seed?.proveedorSugerido?.id ?? '')
  const [numeroComprobante, setNumeroComprobante] = useState(seed?.ocr.numeroComprobante ?? '')
  const [tipoComprobante, setTipoComprobante] = useState(seed?.ocr.tipoComprobante ?? '')
  const [fecha, setFecha] = useState(seed?.ocr.fecha ?? new Date().toISOString().slice(0, 10))
  const [moneda, setMoneda] = useState((seed?.ocr.moneda ?? 'ARS').toUpperCase())
  const [vencimiento, setVencimiento] = useState('')
  const [dealId, setDealId] = useState('')
  const [notas, setNotas] = useState('')
  const [iva, setIva] = useState(seed?.ocr.iva != null ? String(seed.ocr.iva) : '')
  const [totalManual, setTotalManual] = useState(seed?.ocr.total != null ? String(seed.ocr.total) : '')
  const [rows, setRows] = useState<ItemRow[]>(
    seed?.items?.length
      ? seed.items.map((it) => ({
          key: newKey(),
          productId: it.match.productId,
          productName: it.match.productName,
          productSku: it.match.productSku,
          costoActual: it.match.costoActual,
          trackStock: it.match.trackStock,
          matchMotivo: it.match.productId ? it.match.motivo : null,
          sku: it.codigo ?? '',
          nombre: it.descripcion,
          cantidad: String(it.cantidad || 1),
          costoUnitario: String(it.precioUnitario || ''),
        }))
      : [emptyRow()],
  )
  const [saving, setSaving] = useState(false)
  const [pickerRow, setPickerRow] = useState<string | null>(null)
  const [nuevoProvOpen, setNuevoProvOpen] = useState(false)

  const { data: provData, refetch: refetchProv } = useQuery({
    queryKey: ['proveedores-picker'],
    queryFn: async () => (await fetch('/api/empresas?esProveedor=true&limit=500')).json(),
    staleTime: 60_000,
  })
  const proveedores: { id: string; name: string }[] = provData?.data ?? []

  const { data: dealData } = useQuery({
    queryKey: ['deals-picker-compras'],
    queryFn: async () => (await fetch('/api/deals?limit=200')).json(),
    staleTime: 60_000,
  })
  const deals: { id: string; title: string }[] = Array.isArray(dealData?.data)
    ? dealData.data.map((d: any) => ({ id: d.id, title: d.title }))
    : []

  const subtotalItems = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.costoUnitario) || 0) * (Number(r.cantidad) || 0), 0),
    [rows],
  )
  const totalCalc = subtotalItems + (Number(iva) || 0)
  const totalFinal = totalManual !== '' ? Number(totalManual) || 0 : totalCalc
  const totalMismatch = totalManual !== '' && Math.abs((Number(totalManual) || 0) - totalCalc) > 1

  const setRow = (key: string, patch: Partial<ItemRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const submit = async (confirmar: boolean) => {
    const items = rows
      .filter((r) => r.nombre.trim())
      .map((r) => ({
        productId: r.productId,
        sku: r.sku.trim() || null,
        nombre: r.nombre.trim(),
        cantidad: Math.max(1, Math.round(Number(r.cantidad) || 1)),
        costoUnitario: Number(r.costoUnitario) || 0,
      }))
    if (items.length === 0) { toast.error('Cargá al menos un ítem'); return }
    if (confirmar && !proveedorId) { toast.error('Elegí el proveedor antes de confirmar'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedorId: proveedorId || null,
          numeroComprobante: numeroComprobante.trim() || null,
          tipoComprobante: tipoComprobante || null,
          fecha,
          moneda,
          iva: Number(iva) || 0,
          subtotal: subtotalItems,
          total: totalFinal,
          vencimiento: vencimiento || null,
          dealId: dealId || null,
          notas: notas.trim() || null,
          documentoId: seed?.documentoId ?? null,
          ocrRaw: seed?.ocr ?? null,
          items,
          confirmar,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      if (confirmar) {
        const d = json.data
        toast.success(`Compra #${d.numero} confirmada · ${d.movimientos} ingreso${d.movimientos !== 1 ? 's' : ''} de stock${d.alertas ? ` · ${d.alertas} alerta${d.alertas !== 1 ? 's' : ''} de costo` : ''}`)
      } else {
        toast.success('Borrador guardado')
      }
      onSaved()
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      {seed?.documentUrl && (
        <a href={seed.documentUrl} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-primary)' }}>
          <FileText size={13} /> Ver la factura adjunta
        </a>
      )}
      {seed?.ocr.proveedorNombre && !proveedorId && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
          <AlertTriangle size={13} /> La factura dice <strong>{seed.ocr.proveedorNombre}</strong>
          {seed.ocr.proveedorCuit ? ` (CUIT ${seed.ocr.proveedorCuit})` : ''} — elegí o creá el proveedor.
        </div>
      )}

      {/* Cabecera */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="col-span-2 md:col-span-1">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Proveedor</label>
          <div className="flex gap-1">
            <Select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}
              options={[{ value: '', label: '— Elegir —' }, ...proveedores.map((p) => ({ value: p.id, label: p.name }))]} />
            <button type="button" onClick={() => setNuevoProvOpen((v) => !v)}
              className="shrink-0 w-9 rounded-xl flex items-center justify-center" style={{ border: '1px solid var(--color-border-strong)', color: 'var(--color-primary)' }}>
              <Plus size={15} />
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>N° comprobante</label>
          <Input value={numeroComprobante} onChange={(e) => setNumeroComprobante(e.target.value)} placeholder="0001-00001234" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Tipo</label>
          <Select value={tipoComprobante} onChange={(e) => setTipoComprobante(e.target.value)} options={TIPO_COMPROBANTE_OPTS} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Fecha</label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Moneda</label>
          <Select value={moneda} onChange={(e) => setMoneda(e.target.value)} options={MONEDA_OPTS} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Vencimiento (pago)</label>
          <Input type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
        </div>
        <div className="col-span-2 md:col-span-3">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Imputar a una obra / oportunidad (opcional)</label>
          <Select value={dealId} onChange={(e) => setDealId(e.target.value)}
            options={[{ value: '', label: '— Ninguna —' }, ...deals.map((d) => ({ value: d.id, label: d.title }))]} />
        </div>
      </div>

      {nuevoProvOpen && <NuevoProveedorInline onCreated={(id) => { setProveedorId(id); setNuevoProvOpen(false); refetchProv() }} onCancel={() => setNuevoProvOpen(false)} defaultName={seed?.ocr.proveedorNombre ?? ''} defaultCuit={seed?.ocr.proveedorCuit ?? ''} />}

      {/* Ítems */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-subtle)' }}>Ítems</span>
          <Button size="sm" variant="ghost" leftIcon={<Plus size={13} />} onClick={() => setRows((rs) => [...rs, emptyRow()])}>Agregar</Button>
        </div>
        <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}>
          <table className="w-full text-xs">
            <thead style={{ background: 'var(--color-surface-raised)' }}>
              <tr>
                <th className="px-2 py-2 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Descripción</th>
                <th className="px-2 py-2 text-left font-semibold w-28" style={{ color: 'var(--color-text-muted)' }}>Código</th>
                <th className="px-2 py-2 text-right font-semibold w-16" style={{ color: 'var(--color-text-muted)' }}>Cant.</th>
                <th className="px-2 py-2 text-right font-semibold w-28" style={{ color: 'var(--color-text-muted)' }}>Costo u.</th>
                <th className="px-2 py-2 text-left font-semibold w-56" style={{ color: 'var(--color-text-muted)' }}>Producto</th>
                <th className="px-2 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const costoU = Number(r.costoUnitario) || 0
                const delta = r.productId && r.costoActual != null && r.costoActual > 0 && Math.abs(costoU - r.costoActual) > 0.01
                  ? (costoU - r.costoActual) / r.costoActual
                  : null
                return (
                  <tr key={r.key} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td className="px-2 py-1.5">
                      <input value={r.nombre} onChange={(e) => setRow(r.key, { nombre: e.target.value })}
                        className="w-full bg-transparent outline-none py-1" style={{ color: 'var(--color-text)' }} placeholder="Descripción del ítem" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={r.sku} onChange={(e) => setRow(r.key, { sku: e.target.value })}
                        className="w-full bg-transparent outline-none py-1" style={{ color: 'var(--color-text-muted)' }} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min="1" value={r.cantidad} onChange={(e) => setRow(r.key, { cantidad: e.target.value })}
                        className="w-full bg-transparent outline-none py-1 text-right" style={{ color: 'var(--color-text)' }} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min="0" step="0.01" value={r.costoUnitario} onChange={(e) => setRow(r.key, { costoUnitario: e.target.value })}
                        className="w-full bg-transparent outline-none py-1 text-right" style={{ color: 'var(--color-text)' }} placeholder="0.00" />
                      {delta != null && (
                        <div className="flex items-center justify-end gap-0.5 text-[10px] font-semibold" style={{ color: delta > 0 ? '#ef4444' : '#10b981' }}>
                          {delta > 0 ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
                          {Math.abs(Math.round(delta * 1000) / 10)}% · antes {formatMoneyExact(r.costoActual!, moneda)}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5" style={{ position: 'relative' }}>
                      {r.productId ? (
                        <button type="button" onClick={() => setPickerRow(r.key)}
                          className="flex items-center gap-1 text-left max-w-full" style={{ color: 'var(--color-text)' }}>
                          <Link2 size={11} className="shrink-0" style={{ color: '#10b981' }} />
                          <span className="truncate">{r.productName}{r.trackStock ? '' : ' (sin stock)'}</span>
                        </button>
                      ) : (
                        <button type="button" onClick={() => setPickerRow(r.key)}
                          className="flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
                          <Search size={11} /> Vincular producto
                        </button>
                      )}
                      {r.matchMotivo && <div className="text-[10px]" style={{ color: 'var(--color-text-subtle)' }}>{r.matchMotivo}</div>}
                      {pickerRow === r.key && (
                        <ProductoPicker
                          onPick={(p) => { setRow(r.key, { productId: p?.id ?? null, productName: p?.name ?? null, productSku: p?.sku ?? null, costoActual: p?.costo ?? null, trackStock: p?.trackStock ?? false, matchMotivo: p ? 'Elegido a mano' : null }); setPickerRow(null) }}
                          onClose={() => setPickerRow(null)}
                        />
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                        className="p-1 rounded hover:bg-red-500/10 hover:text-red-400" style={{ color: 'var(--color-text-subtle)' }}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totales */}
      <div className="flex justify-end">
        <div className="w-64 space-y-1.5 text-sm">
          <div className="flex justify-between"><span style={{ color: 'var(--color-text-muted)' }}>Subtotal ítems</span><span style={{ color: 'var(--color-text)' }}>{formatMoneyExact(subtotalItems, moneda)}</span></div>
          <div className="flex justify-between items-center">
            <span style={{ color: 'var(--color-text-muted)' }}>IVA</span>
            <input type="number" min="0" step="0.01" value={iva} onChange={(e) => setIva(e.target.value)} placeholder="0.00"
              className="w-28 text-right rounded-lg px-2 py-1 text-sm outline-none" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
          </div>
          <div className="flex justify-between items-center font-bold">
            <span style={{ color: 'var(--color-text)' }}>Total</span>
            <input type="number" min="0" step="0.01" value={totalManual} onChange={(e) => setTotalManual(e.target.value)} placeholder={formatMoneyExact(totalCalc, moneda)}
              className="w-28 text-right rounded-lg px-2 py-1 text-sm outline-none" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
          </div>
          {totalMismatch && (
            <p className="text-[11px]" style={{ color: '#f59e0b' }}>
              El total cargado no coincide con subtotal + IVA ({formatMoneyExact(totalCalc, moneda)}).
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Notas</label>
        <textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)}
          className="w-full rounded-xl px-3 py-2 text-sm resize-none outline-none" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
      </div>

      <ModalFooter>
        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="button" variant="outline" onClick={() => submit(false)} loading={saving}>Guardar borrador</Button>
        <Button type="button" onClick={() => submit(true)} loading={saving}>Confirmar compra</Button>
      </ModalFooter>
    </div>
  )
}

// ─── Picker de producto ──────────────────────────────────────────────────
function ProductoPicker({ onPick, onClose }: {
  onPick: (p: { id: string; name: string; sku: string | null; costo: number | null; trackStock: boolean } | null) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const { data } = useQuery({
    queryKey: ['product-search', q],
    queryFn: async () => (await fetch(`/api/products?search=${encodeURIComponent(q)}`)).json(),
    enabled: q.trim().length >= 2,
  })
  const results: any[] = data?.data ?? []

  return (
    <div className="absolute z-20 mt-1 w-72 rounded-xl p-2 shadow-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)' }}>
      <div className="flex items-center gap-1 mb-1.5">
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto..." leftIcon={<Search size={13} />} />
        <button onClick={onClose} className="shrink-0 p-1" style={{ color: 'var(--color-text-muted)' }}><X size={14} /></button>
      </div>
      <button onClick={() => onPick(null)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-left hover:bg-[var(--color-surface-raised)]" style={{ color: 'var(--color-text-muted)' }}>
        <Unlink size={12} /> Dejar sin vincular (no ingresa stock)
      </button>
      <div className="max-h-52 overflow-y-auto mt-1">
        {results.map((p) => (
          <button key={p.id} onClick={() => onPick({ id: p.id, name: p.name, sku: p.sku ?? null, costo: p.costo ?? null, trackStock: !!p.trackStock })}
            className="w-full px-2 py-1.5 rounded-lg text-xs text-left hover:bg-[var(--color-surface-raised)]">
            <div className="font-medium truncate" style={{ color: 'var(--color-text)' }}>{p.name}</div>
            <div style={{ color: 'var(--color-text-subtle)' }}>{p.sku || 'sin SKU'} {p.trackStock ? '· trackea stock' : ''}</div>
          </button>
        ))}
        {q.trim().length >= 2 && results.length === 0 && (
          <p className="text-xs px-2 py-2" style={{ color: 'var(--color-text-muted)' }}>Sin resultados. Cargá el producto desde Catálogo y volvé.</p>
        )}
      </div>
    </div>
  )
}

// ─── Alta rápida de proveedor ────────────────────────────────────────────
function NuevoProveedorInline({ onCreated, onCancel, defaultName, defaultCuit }: {
  onCreated: (id: string) => void; onCancel: () => void; defaultName: string; defaultCuit: string
}) {
  const [name, setName] = useState(defaultName)
  const [cuit, setCuit] = useState(defaultCuit)
  const [cbu, setCbu] = useState('')
  const [saving, setSaving] = useState(false)

  const create = async () => {
    if (!name.trim()) { toast.error('El nombre es requerido'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/empresas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), cuit: cuit.trim() || null, cbu: cbu.trim() || null, esProveedor: true }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success('Proveedor creado')
      onCreated(json.data.id)
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl p-3 space-y-2" style={{ border: '1px solid var(--color-border-strong)', background: 'var(--color-surface-raised)' }}>
      <div className="grid grid-cols-3 gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Razón social *" />
        <Input value={cuit} onChange={(e) => setCuit(e.target.value)} placeholder="CUIT" />
        <Input value={cbu} onChange={(e) => setCbu(e.target.value)} placeholder="CBU / alias" />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={create} loading={saving}>Crear proveedor</Button>
      </div>
    </div>
  )
}
