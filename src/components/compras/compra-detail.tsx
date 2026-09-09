'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, Trash2, ArrowUpCircle, Ban, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatMoneyExact } from '@/lib/utils'
import toast from 'react-hot-toast'

const ESTADO_META: Record<string, { label: string; color: string; bg: string }> = {
  BORRADOR:   { label: 'Borrador',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  CONFIRMADA: { label: 'Confirmada', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  ANULADA:    { label: 'Anulada',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}
const PAGO_META: Record<string, { label: string; color: string }> = {
  PENDIENTE: { label: 'Pago pendiente', color: '#ef4444' },
  PARCIAL:   { label: 'Pago parcial',   color: '#f59e0b' },
  PAGADA:    { label: 'Pagada',         color: '#10b981' },
}
const MEDIO_PAGO = [
  { value: '', label: '— Medio —' },
  { value: 'Transferencia', label: 'Transferencia' },
  { value: 'Cheque', label: 'Cheque' },
  { value: 'Efectivo', label: 'Efectivo' },
  { value: 'Tarjeta', label: 'Tarjeta' },
]

export function CompraDetail({ compraId, onChanged }: { compraId: string; onChanged: () => void }) {
  const qc = useQueryClient()
  const [pagoMonto, setPagoMonto] = useState('')
  const [pagoMedio, setPagoMedio] = useState('')
  const [pagoFecha, setPagoFecha] = useState(new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['compra', compraId],
    queryFn: async () => (await fetch(`/api/compras/${compraId}`)).json(),
  })
  const c = data?.data

  const invalidate = () => {
    refetch()
    qc.invalidateQueries({ queryKey: ['compras'] })
    qc.invalidateQueries({ queryKey: ['stock-actual'] })
    qc.invalidateQueries({ queryKey: ['stock-movimientos'] })
    qc.invalidateQueries({ queryKey: ['alertas-costo'] })
    onChanged()
  }

  const confirmar = async () => {
    if (!confirm('Confirmar la compra ingresa el stock y no se puede deshacer fácil. ¿Seguir?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/compras/${compraId}/confirmar`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success(`Confirmada · ${json.data.movimientos} ingreso(s) de stock`)
      invalidate()
    } catch { toast.error('Error de conexión') } finally { setBusy(false) }
  }

  const anular = async () => {
    if (!confirm('Anular revierte el stock ingresado. ¿Seguir?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/compras/${compraId}/anular`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success('Compra anulada')
      invalidate()
    } catch { toast.error('Error de conexión') } finally { setBusy(false) }
  }

  const agregarPago = async () => {
    const monto = Number(pagoMonto)
    if (!monto || monto <= 0) { toast.error('Monto inválido'); return }
    setBusy(true)
    try {
      const res = await fetch(`/api/compras/${compraId}/pagos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto, medio: pagoMedio || null, fecha: pagoFecha }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success('Pago registrado')
      setPagoMonto('')
      invalidate()
    } catch { toast.error('Error de conexión') } finally { setBusy(false) }
  }

  const borrarPago = async (pagoId: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/compras/${compraId}/pagos?pagoId=${pagoId}`, { method: 'DELETE' })
      if (!res.ok) { const j = await res.json(); toast.error(j.error ?? 'Error'); return }
      invalidate()
    } catch { toast.error('Error de conexión') } finally { setBusy(false) }
  }

  if (isLoading || !c) return <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>

  const estado = ESTADO_META[c.estado] ?? ESTADO_META.BORRADOR
  const pago = PAGO_META[c.estadoPago] ?? PAGO_META.PENDIENTE

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: estado.bg, color: estado.color }}>{estado.label}</span>
        {c.estado === 'CONFIRMADA' && (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: 'var(--color-surface-raised)', color: pago.color }}>{pago.label}</span>
        )}
        {c.numero && <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Compra #{c.numero}</span>}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Field label="Proveedor" value={c.proveedor?.name ?? '—'} />
        <Field label="Comprobante" value={[c.tipoComprobante?.replace('_', ' '), c.numeroComprobante].filter(Boolean).join(' ') || '—'} />
        <Field label="Fecha" value={new Date(c.fecha).toLocaleDateString('es-AR')} />
        <Field label="Vencimiento" value={c.vencimiento ? new Date(c.vencimiento).toLocaleDateString('es-AR') : '—'} />
        {c.deal && <Field label="Obra" value={c.deal.title} />}
        <Field label="Total" value={`${formatMoneyExact(c.total, c.moneda)} (${c.moneda})`} />
      </div>

      {c.documento && (
        <a href={c.documento.url} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-primary)' }}>
          <FileText size={13} /> Ver factura adjunta
        </a>
      )}

      {/* Ítems */}
      <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-xs">
          <thead style={{ background: 'var(--color-surface-raised)' }}>
            <tr>
              <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Ítem</th>
              <th className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Cant.</th>
              <th className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Costo u.</th>
              <th className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Subtotal</th>
              <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Stock</th>
            </tr>
          </thead>
          <tbody>
            {c.items.map((it: any) => (
              <tr key={it.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                <td className="px-3 py-2" style={{ color: 'var(--color-text)' }}>
                  {it.nombre}
                  {it.sku && <span className="text-[10px] ml-1" style={{ color: 'var(--color-text-subtle)' }}>{it.sku}</span>}
                </td>
                <td className="px-3 py-2 text-right" style={{ color: 'var(--color-text)' }}>{it.cantidad}</td>
                <td className="px-3 py-2 text-right" style={{ color: 'var(--color-text)' }}>{formatMoneyExact(it.costoUnitario, c.moneda)}</td>
                <td className="px-3 py-2 text-right" style={{ color: 'var(--color-text)' }}>{formatMoneyExact(it.subtotal, c.moneda)}</td>
                <td className="px-3 py-2" style={{ color: 'var(--color-text-subtle)' }}>
                  {it.productId ? (c.movimientos.some((m: any) => m.productId === it.productId) ? <span className="inline-flex items-center gap-1" style={{ color: '#10b981' }}><ArrowUpCircle size={11} /> ingresado</span> : 'vinculado') : 'sin vincular'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Acciones de estado */}
      {c.estado === 'BORRADOR' && (
        <Button onClick={confirmar} loading={busy} leftIcon={<CheckCircle2 size={15} />}>Confirmar compra (ingresa stock)</Button>
      )}
      {c.estado === 'CONFIRMADA' && (
        <div className="space-y-4">
          {/* Pagos */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-subtle)' }}>
              Pagos — saldo {formatMoneyExact(c.saldo, c.moneda)}
            </p>
            {c.pagos.length > 0 && (
              <div className="space-y-1 mb-2">
                {c.pagos.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-surface-raised)' }}>
                    <span style={{ color: 'var(--color-text)' }}>
                      {formatMoneyExact(p.monto, c.moneda)} · {new Date(p.fecha).toLocaleDateString('es-AR')} {p.medio ? `· ${p.medio}` : ''}
                    </span>
                    <button onClick={() => borrarPago(p.id)} className="p-1 hover:text-red-400" style={{ color: 'var(--color-text-subtle)' }}><Trash2 size={11} /></button>
                  </div>
                ))}
              </div>
            )}
            {c.estadoPago !== 'PAGADA' && (
              <div className="flex items-end gap-2 flex-wrap">
                <div className="w-28"><label className="block text-[10px] mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Monto</label>
                  <Input type="number" min="0" step="0.01" value={pagoMonto} onChange={(e) => setPagoMonto(e.target.value)} placeholder="0.00" /></div>
                <div className="w-36"><Select value={pagoMedio} onChange={(e) => setPagoMedio(e.target.value)} options={MEDIO_PAGO} /></div>
                <div className="w-36"><Input type="date" value={pagoFecha} onChange={(e) => setPagoFecha(e.target.value)} /></div>
                <Button size="sm" onClick={agregarPago} loading={busy} leftIcon={<Plus size={13} />}>Registrar pago</Button>
              </div>
            )}
          </div>

          <button onClick={anular} disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg" style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
            <Ban size={13} /> Anular compra (revierte el stock)
          </button>
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>{label}</p>
      <p style={{ color: 'var(--color-text)' }}>{value}</p>
    </div>
  )
}
