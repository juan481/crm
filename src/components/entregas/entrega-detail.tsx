'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, Ban, CheckCircle2, Download, FileText, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatMoneyExact } from '@/lib/utils'
import { loadLogoForPdf, drawPdfHeader, drawBrandedFooter } from '@/lib/pdf-branding'
import toast from 'react-hot-toast'

const ESTADO_META: Record<string, { label: string; color: string; bg: string }> = {
  BORRADOR:  { label: 'Preparando', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  ENTREGADA: { label: 'Entregada',  color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  ANULADA:   { label: 'Anulada',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

export function EntregaDetail({ entregaId, onChanged, onDeleted }: {
  entregaId: string; onChanged: () => void; onDeleted: () => void
}) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState<{ retiradoPor: string; items: Record<string, string> } | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['entrega', entregaId],
    queryFn: async () => (await fetch(`/api/entregas/${entregaId}`)).json(),
  })
  const e = data?.data

  const invalidate = () => {
    refetch()
    qc.invalidateQueries({ queryKey: ['entregas'] })
    qc.invalidateQueries({ queryKey: ['stock-actual'] })
    qc.invalidateQueries({ queryKey: ['stock-movimientos'] })
    qc.invalidateQueries({ queryKey: ['stock-resumen-cards'] })
    qc.invalidateQueries({ queryKey: ['deal-materiales'] })
    qc.invalidateQueries({ queryKey: ['deal-rentabilidad'] })
    onChanged()
  }

  const startEdit = () => setEdit({
    retiradoPor: e.retiradoPor,
    items: Object.fromEntries(e.items.map((it: any) => [it.id, String(it.cantidad)])),
  })

  const saveEdit = async () => {
    if (!edit) return
    setBusy(true)
    try {
      const items = e.items.map((it: any) => ({
        productId: it.productId,
        nombre: it.nombre,
        cantidad: Math.max(1, Math.round(Number(edit.items[it.id]) || 1)),
      })).filter((it: any) => it.productId)
      const res = await fetch(`/api/entregas/${entregaId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retiradoPor: edit.retiradoPor, items }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success('Guardado')
      setEdit(null)
      invalidate()
    } catch { toast.error('Error de conexión') } finally { setBusy(false) }
  }

  const entregar = async () => {
    if (!confirm('Entregar descuenta el stock y no se puede deshacer fácil. ¿Seguir?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/entregas/${entregaId}/entregar`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success(`Entregada · ${json.data.movimientos} salida(s) de stock`)
      invalidate()
    } catch { toast.error('Error de conexión') } finally { setBusy(false) }
  }

  const anular = async () => {
    if (!confirm('Anular la entrega. Si ya estaba entregada, reingresa el stock. ¿Seguir?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/entregas/${entregaId}/anular`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success('Entrega anulada')
      invalidate()
    } catch { toast.error('Error de conexión') } finally { setBusy(false) }
  }

  const eliminar = async () => {
    if (!confirm('Eliminar este borrador libera las reservas de stock. ¿Seguir?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/entregas/${entregaId}`, { method: 'DELETE' })
      if (!res.ok) { const j = await res.json(); toast.error(j.error ?? 'Error'); return }
      toast.success('Borrador eliminado')
      onDeleted()
    } catch { toast.error('Error de conexión') } finally { setBusy(false) }
  }

  const descargarRemito = async () => {
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pw = 210, mg = 20, cw = pw - mg * 2
      const hex = (e.org.primaryColor || '#6366f1').replace('#', '')
      const pr = parseInt(hex.slice(0, 2), 16), pg = parseInt(hex.slice(2, 4), 16), pb = parseInt(hex.slice(4, 6), 16)
      const logo = await loadLogoForPdf(e.org.logoUrl)

      const headerH = drawPdfHeader(doc, {
        pw, mg, pr, pg, pb, logo, orgName: e.org.name,
        kicker: 'Remito interno',
        dateLabel: new Date(e.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }),
      })
      let y = headerH + 14
      doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
      doc.text(e.numero ? `Remito N° ${e.numero}` : 'Remito (borrador)', mg, y); y += 8
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 116, 139)
      doc.text(`Retira: ${e.retiradoPor}`, mg, y); y += 5
      if (e.motivo) { doc.text(`Motivo: ${e.motivo}`, mg, y); y += 5 }
      if (e.empresa?.name) { doc.text(`Empresa: ${e.empresa.name}`, mg, y); y += 5 }
      if (e.cotizacion?.ref) { doc.text(`Presupuesto: ${e.cotizacion.ref}`, mg, y); y += 5 }
      y += 4

      doc.setFillColor(241, 245, 249); doc.rect(mg, y, cw, 8, 'F')
      doc.setTextColor(148, 163, 184); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
      doc.text('PRODUCTO', mg + 2, y + 5.5)
      doc.text('CANTIDAD', mg + cw - 2, y + 5.5, { align: 'right' })
      y += 8
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
      e.items.forEach((it: any, idx: number) => {
        if (y > 268) { doc.addPage(); y = 20 }
        if (idx % 2 === 1) { doc.setFillColor(248, 250, 252); doc.rect(mg, y, cw, 8, 'F') }
        doc.setTextColor(30, 41, 59)
        doc.text(String(it.nombre).slice(0, 70), mg + 2, y + 5.5)
        doc.text(String(it.cantidad), mg + cw - 2, y + 5.5, { align: 'right' })
        y += 8
      })
      if (y > 250) { doc.addPage(); y = 20 }
      y += 12
      doc.setDrawColor(226, 232, 240); doc.line(mg, y, mg + cw * 0.4, y)
      doc.line(mg + cw * 0.6, y, mg + cw, y); y += 5
      doc.setTextColor(148, 163, 184); doc.setFontSize(8)
      doc.text('Entregó', mg, y); doc.text('Recibió', mg + cw * 0.6, y)
      y += 14
      drawBrandedFooter(doc, { pw, mg, y, pr, pg, pb, leftText: e.org.name })

      doc.save(`remito-${e.numero ?? 'borrador'}.pdf`)
    } catch (err) {
      console.error(err)
      toast.error('No se pudo generar el remito')
    }
  }

  if (isLoading || !e) return <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>

  const meta = ESTADO_META[e.estado] ?? ESTADO_META.BORRADOR
  const costoTotal = e.items.reduce((s: number, it: any) => s + (it.costoUnitario ?? 0) * it.cantidad, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
        {e.numero && <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Remito #{e.numero}</span>}
        {e.cotizacion?.ref && <span className="text-xs inline-flex items-center gap-1" style={{ color: 'var(--color-text-subtle)' }}><FileText size={11} /> {e.cotizacion.ref}</span>}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <p className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>Retira</p>
          {edit ? (
            <Input value={edit.retiradoPor} onChange={(ev) => setEdit({ ...edit, retiradoPor: ev.target.value })} />
          ) : <p style={{ color: 'var(--color-text)' }}>{e.retiradoPor}</p>}
        </div>
        <div><p className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>Fecha</p><p style={{ color: 'var(--color-text)' }}>{new Date(e.fecha).toLocaleDateString('es-AR')}</p></div>
        {e.motivo && <div className="col-span-2"><p className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>Motivo</p><p style={{ color: 'var(--color-text)' }}>{e.motivo}</p></div>}
        {e.empresa?.name && <div><p className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>Empresa</p><p style={{ color: 'var(--color-text)' }}>{e.empresa.name}</p></div>}
        {e.deal?.title && <div><p className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>Obra</p><p style={{ color: 'var(--color-text)' }}>{e.deal.title}</p></div>}
      </div>

      <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-xs">
          <thead style={{ background: 'var(--color-surface-raised)' }}>
            <tr>
              <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Producto</th>
              <th className="px-3 py-2 text-right font-semibold w-24" style={{ color: 'var(--color-text-muted)' }}>Cant.</th>
              <th className="px-3 py-2 text-right font-semibold w-28" style={{ color: 'var(--color-text-muted)' }}>Depósito</th>
            </tr>
          </thead>
          <tbody>
            {e.items.map((it: any) => (
              <tr key={it.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                <td className="px-3 py-2" style={{ color: 'var(--color-text)' }}>{it.nombre}</td>
                <td className="px-3 py-2 text-right">
                  {edit ? (
                    <input type="number" min="1" value={edit.items[it.id] ?? ''} onChange={(ev) => setEdit({ ...edit, items: { ...edit.items, [it.id]: ev.target.value } })}
                      className="w-16 text-right rounded px-1 py-0.5 outline-none" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
                  ) : <span style={{ color: 'var(--color-text)' }}>{it.cantidad}</span>}
                </td>
                <td className="px-3 py-2 text-right" style={{ color: it.product && it.product.trackStock && it.cantidad > it.product.stock ? '#ef4444' : 'var(--color-text-subtle)' }}>
                  {it.product ? (it.product.trackStock ? `${it.product.stock} (${it.product.stockReservado} res.)` : 'sin control') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {costoTotal > 0 && (
        <p className="text-xs text-right" style={{ color: 'var(--color-text-muted)' }}>Costo del material: {formatMoneyExact(costoTotal, 'USD')}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button onClick={descargarRemito} className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg" style={{ color: 'var(--color-primary)', border: '1px solid var(--color-border)' }}>
          <Download size={13} /> Remito PDF
        </button>

        {e.estado === 'BORRADOR' && !edit && (
          <>
            <Button size="sm" onClick={entregar} loading={busy} leftIcon={<CheckCircle2 size={14} />}>Entregar (descuenta stock)</Button>
            <button onClick={startEdit} className="text-xs px-3 py-2 rounded-lg" style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>Editar cantidades</button>
            <button onClick={eliminar} disabled={busy} className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-lg" style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
              <Trash2 size={12} /> Eliminar
            </button>
          </>
        )}
        {edit && (
          <>
            <Button size="sm" onClick={saveEdit} loading={busy} leftIcon={<Save size={13} />}>Guardar</Button>
            <button onClick={() => setEdit(null)} className="text-xs px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>Cancelar</button>
          </>
        )}
        {e.estado === 'ENTREGADA' && (
          <button onClick={anular} disabled={busy} className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg" style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
            <Ban size={13} /> Anular (reingresa el stock)
          </button>
        )}
      </div>
    </div>
  )
}
