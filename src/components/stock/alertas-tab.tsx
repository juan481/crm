'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowUp, ArrowDown, Check, X, ShoppingCart, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { formatMoneyExact } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Alerta {
  id: string
  costoAnterior: number
  costoNuevo: number
  precioAnterior: number | null
  precioNuevo: number | null
  variacionPct: number
  origen: string
  compraId: string | null
  estado: string
  nota: string | null
  createdAt: string
  product: { id: string; name: string; sku: string | null; currency: string }
}

const ESTADO_OPTS = [
  { value: 'PENDIENTE', label: 'Pendientes' },
  { value: 'APLICADA', label: 'Aplicadas' },
  { value: 'DESCARTADA', label: 'Descartadas' },
  { value: 'TODAS', label: 'Todas' },
]

export function AlertasTab() {
  const qc = useQueryClient()
  const [estado, setEstado] = useState('PENDIENTE')
  const [busyId, setBusyId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['alertas-costo', estado],
    queryFn: async () => (await fetch(`/api/alertas-costo?estado=${estado}&limit=100`)).json(),
    staleTime: 15_000,
  })
  const alertas: Alerta[] = data?.data ?? []

  const act = async (id: string, accion: 'aplicar' | 'descartar') => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/alertas-costo/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success(accion === 'aplicar' ? 'Costo actualizado' : 'Alerta descartada')
      qc.invalidateQueries({ queryKey: ['alertas-costo'] })
      qc.invalidateQueries({ queryKey: ['stock-actual'] })
      qc.invalidateQueries({ queryKey: ['stock-resumen-cards'] })
      qc.invalidateQueries({ queryKey: ['deal-rentabilidad'] })
      qc.invalidateQueries({ queryKey: ['dashboard-deposito'] })
    } catch { toast.error('Error de conexión') } finally { setBusyId(null) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="w-44"><Select value={estado} onChange={(e) => setEstado(e.target.value)} options={ESTADO_OPTS} /></div>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Aplicar el costo nuevo actualiza el producto; el costo alimenta el margen de las cotizaciones.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
      ) : alertas.length === 0 ? (
        <div className="surface rounded-2xl p-10 text-center">
          <AlertTriangle size={30} className="mx-auto mb-3 opacity-25" />
          <p className="font-medium" style={{ color: 'var(--color-text)' }}>
            {estado === 'PENDIENTE' ? 'No hay alertas pendientes' : 'Sin alertas'}
          </p>
          <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: 'var(--color-text-muted)' }}>
            Las alertas aparecen cuando una factura de compra o el catálogo del proveedor cambian un costo.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alertas.map((a) => {
            const sube = a.costoNuevo > a.costoAnterior
            const sospechosa = !!a.nota
            return (
              <div key={a.id} className="rounded-xl p-3" style={{ border: sospechosa ? '1px solid rgba(245,158,11,0.4)' : '1px solid var(--color-border)', background: sospechosa ? 'rgba(245,158,11,0.06)' : undefined }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{a.product.name}</div>
                    <div className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--color-text-subtle)' }}>
                      {a.product.sku && <span>{a.product.sku}</span>}
                      <span className="inline-flex items-center gap-0.5">
                        {a.origen === 'COMPRA' ? <ShoppingCart size={10} /> : <RefreshCw size={10} />}
                        {a.origen === 'COMPRA' ? 'compra' : 'catálogo'}
                      </span>
                      <span>{new Date(a.createdAt).toLocaleDateString('es-AR')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <span style={{ color: 'var(--color-text-subtle)' }}>{formatMoneyExact(a.costoAnterior, a.product.currency)}</span>
                    <span className="inline-flex items-center gap-0.5 font-semibold" style={{ color: sube ? '#ef4444' : '#10b981' }}>
                      {sube ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                      {formatMoneyExact(a.costoNuevo, a.product.currency)}
                    </span>
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: sospechosa ? 'rgba(245,158,11,0.15)' : sube ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', color: sospechosa ? '#f59e0b' : sube ? '#ef4444' : '#10b981' }}>
                      {a.variacionPct > 0 ? '+' : ''}{a.variacionPct}%
                    </span>
                  </div>

                  {a.estado === 'PENDIENTE' ? (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => act(a.id, 'descartar')} disabled={busyId === a.id}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium"
                        style={sospechosa
                          ? { background: 'var(--color-primary)', color: '#fff' }
                          : { color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                        <X size={13} /> Descartar
                      </button>
                      <button onClick={() => { if (!sospechosa || confirm('Esta alerta parece un error de moneda o de carga. ¿Aplicar el costo nuevo igual?')) act(a.id, 'aplicar') }}
                        disabled={busyId === a.id}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium"
                        style={sospechosa
                          ? { color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)' }
                          : { background: 'var(--color-primary)', color: '#fff' }}>
                        <Check size={13} /> Aplicar
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                      {a.estado === 'APLICADA' ? 'Aplicada' : 'Descartada'}
                    </span>
                  )}
                </div>
                {a.nota && (
                  <p className="text-[11px] mt-2 flex items-start gap-1.5" style={{ color: '#b45309' }}>
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" /> {a.nota}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
