'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2, Search, AlertTriangle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { ModalFooter } from '@/components/ui/modal'
import { ProductoPicker } from '@/components/shared/producto-picker'
import toast from 'react-hot-toast'

interface Row {
  key: string
  productId: string | null
  nombre: string
  sku: string | null
  cantidad: string
  stock: number
  trackStock: boolean
}

let seq = 0
const newKey = () => `er-${seq++}`
const emptyRow = (): Row => ({ key: newKey(), productId: null, nombre: '', sku: null, cantidad: '1', stock: 0, trackStock: false })

export function EntregaForm({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const [retiradoPor, setRetiradoPor] = useState('')
  const [motivo, setMotivo] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [empresaId, setEmpresaId] = useState('')
  const [dealId, setDealId] = useState('')
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [pickerRow, setPickerRow] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const { data: empData } = useQuery({
    queryKey: ['empresas-picker-entrega'],
    queryFn: async () => (await fetch('/api/empresas?limit=500')).json(),
    staleTime: 60_000,
  })
  const empresas: { id: string; name: string }[] = empData?.data ?? []

  const { data: dealData } = useQuery({
    queryKey: ['deals-picker-entrega'],
    queryFn: async () => (await fetch('/api/deals?limit=200')).json(),
    staleTime: 60_000,
  })
  const deals: { id: string; title: string }[] = Array.isArray(dealData?.data)
    ? dealData.data.map((d: any) => ({ id: d.id, title: d.title })) : []

  const setRow = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const faltante = useMemo(
    () => rows.some((r) => r.productId && r.trackStock && Number(r.cantidad) > r.stock),
    [rows],
  )

  const submit = async (entregar: boolean) => {
    if (!retiradoPor.trim()) { toast.error('Indicá quién retira'); return }
    const items = rows
      .filter((r) => r.productId && Number(r.cantidad) > 0)
      .map((r) => ({ productId: r.productId, nombre: r.nombre, cantidad: Math.max(1, Math.round(Number(r.cantidad) || 1)) }))
    if (items.length === 0) { toast.error('Agregá al menos un producto'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/entregas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retiradoPor: retiradoPor.trim(), motivo: motivo.trim() || null, fecha, empresaId: empresaId || null, dealId: dealId || null, items, entregar }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success(entregar ? `Entregada · ${json.data.movimientos} salida(s) de stock` : 'Entrega preparada (stock reservado)')
      onSaved(json.data.id)
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Retira <span className="text-red-400">*</span></label>
          <Input value={retiradoPor} onChange={(e) => setRetiradoPor(e.target.value)} placeholder="Técnico, flete, nombre..." />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Fecha</label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Motivo / referencia</label>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: pedido 345 del presupuesto 64.99" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Empresa (opcional)</label>
          <Select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}
            options={[{ value: '', label: '— Ninguna —' }, ...empresas.map((e) => ({ value: e.id, label: e.name }))]} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Obra / oportunidad (opcional)</label>
          <Select value={dealId} onChange={(e) => setDealId(e.target.value)}
            options={[{ value: '', label: '— Ninguna —' }, ...deals.map((d) => ({ value: d.id, label: d.title }))]} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-subtle)' }}>Material</span>
          <Button size="sm" variant="ghost" leftIcon={<Plus size={13} />} onClick={() => setRows((rs) => [...rs, emptyRow()])}>Agregar</Button>
        </div>
        <div className="rounded-xl overflow-visible" style={{ border: '1px solid var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--color-surface-raised)' }}>
              <tr>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Producto</th>
                <th className="px-3 py-2 text-right font-semibold w-24" style={{ color: 'var(--color-text-muted)' }}>Cant.</th>
                <th className="px-3 py-2 text-right font-semibold w-24" style={{ color: 'var(--color-text-muted)' }}>Depósito</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const excede = r.productId && r.trackStock && Number(r.cantidad) > r.stock
                return (
                  <tr key={r.key} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td className="px-3 py-1.5" style={{ position: 'relative' }}>
                      {r.productId ? (
                        <button type="button" onClick={() => setPickerRow(r.key)} className="text-left" style={{ color: 'var(--color-text)' }}>
                          {r.nombre} {r.sku && <span className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>{r.sku}</span>}
                        </button>
                      ) : (
                        <button type="button" onClick={() => setPickerRow(r.key)} className="flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
                          <Search size={12} /> Elegir producto
                        </button>
                      )}
                      {pickerRow === r.key && (
                        <ProductoPicker
                          onClose={() => setPickerRow(null)}
                          onPick={(p) => {
                            if (p) setRow(r.key, { productId: p.id, nombre: p.name, sku: p.sku, stock: p.stock, trackStock: p.trackStock })
                            setPickerRow(null)
                          }}
                        />
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="number" min="1" value={r.cantidad} onChange={(e) => setRow(r.key, { cantidad: e.target.value })}
                        className="w-full text-right bg-transparent outline-none py-1" style={{ color: excede ? '#ef4444' : 'var(--color-text)' }} />
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                      {r.productId ? (r.trackStock ? r.stock : '—') : ''}
                    </td>
                    <td className="px-3 py-1.5 text-center">
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
        {faltante && (
          <p className="flex items-center gap-1.5 text-[11px] mt-1.5" style={{ color: '#f59e0b' }}>
            <AlertTriangle size={12} /> Algún ítem supera el stock del depósito. Podés preparar igual (reserva), pero no vas a poder entregar hasta reponer.
          </p>
        )}
      </div>

      <ModalFooter>
        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="button" variant="outline" onClick={() => submit(false)} loading={saving}>Preparar (reservar)</Button>
        <Button type="button" onClick={() => submit(true)} loading={saving} disabled={faltante}>Entregar ahora</Button>
      </ModalFooter>
    </div>
  )
}
