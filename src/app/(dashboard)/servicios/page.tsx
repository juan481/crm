'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  RefreshCw, Plus, Search, Shield, Radio, Pencil, Trash2, AlertTriangle,
  TrendingUp, CalendarClock, Building2, FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ServicioForm } from '@/components/servicios/servicio-form'
import { formatCurrency } from '@/lib/utils'
import { ESTADO_OPTIONS, ESTADO_LABEL, CANAL_OPTIONS, MONEDAS_VALIDAS, MODO_LICENCIA_LABEL } from '@/lib/servicios-recurrentes'
import { useAuthStore } from '@/store/auth-store'
import type { ServicioRecurrente } from '@/types'
import toast from 'react-hot-toast'

interface Kpis {
  total: number
  activos: number
  conMonitoreo: number
  mrrPorMoneda: Record<string, number>
  arrPorMoneda: Record<string, number>
  porCanal: Record<string, number>
  renovaciones: { d30: number; d60: number; d90: number }
}
interface ListResponse { data: ServicioRecurrente[]; kpis: Kpis }

function money(byCur: Record<string, number>): string {
  const e = Object.entries(byCur).filter(([, v]) => v > 0.005)
  if (e.length === 0) return formatCurrency(0)
  return e.map(([c, v]) => formatCurrency(v, c)).join('  +  ')
}

const ESTADO_VARIANT: Record<string, 'success' | 'warning' | 'neutral'> = {
  ACTIVO: 'success', PAUSADO: 'warning', BAJA: 'neutral',
}

export default function ServiciosPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')

  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('')
  const [canal, setCanal] = useState('')
  const [moneda, setMoneda] = useState('')
  const [monitoreo, setMonitoreo] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ServicioRecurrente | null>(null)
  const [deleting, setDeleting] = useState<ServicioRecurrente | null>(null)
  const [delLoading, setDelLoading] = useState(false)
  const [genOpen, setGenOpen] = useState(false)

  const params = new URLSearchParams()
  if (estado) params.set('estado', estado)
  if (canal) params.set('canal', canal)
  if (moneda) params.set('moneda', moneda)
  if (monitoreo) params.set('monitoreo', monitoreo)

  const { data, isLoading, isError } = useQuery<ListResponse>({
    queryKey: ['servicios-recurrentes', estado, canal, moneda, monitoreo],
    queryFn: async () => {
      const r = await fetch(`/api/servicios-recurrentes?${params}`)
      if (!r.ok) throw new Error((await r.json()).error || 'Error')
      return r.json()
    },
    enabled: !!isAdmin,
  })

  const rows = useMemo(() => {
    const list = data?.data ?? []
    const term = q.trim().toLowerCase()
    if (!term) return list
    return list.filter(s =>
      s.nombre.toLowerCase().includes(term) || (s.empresa?.name ?? '').toLowerCase().includes(term))
  }, [data, q])

  const kpis = data?.kpis

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['servicios-recurrentes'] })
    qc.invalidateQueries({ queryKey: ['invoices'] })
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDelLoading(true)
    try {
      const r = await fetch(`/api/servicios-recurrentes/${deleting.id}`, { method: 'DELETE' })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error || 'No se pudo borrar'); return }
      toast.success('Servicio borrado')
      setDeleting(null)
      refresh()
    } catch { toast.error('Error de conexión') } finally { setDelLoading(false) }
  }

  if (!isAdmin) {
    return <div className="surface rounded-2xl p-6 text-sm text-[var(--color-text-muted)]">Solo un administrador puede ver los servicios recurrentes.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Servicios recurrentes</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Abonos, monitoreo y contratos de todos los clientes.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" leftIcon={<FileText size={14} />} onClick={() => setGenOpen(true)}>
            Generar facturas del mes
          </Button>
          <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => { setEditing(null); setFormOpen(true) }}>
            Nuevo servicio
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="surface rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-1"><TrendingUp size={13} /> Ingreso mensual (MRR)</div>
            <p className="text-lg font-bold text-[var(--color-text)] leading-tight">{money(kpis.mrrPorMoneda)}</p>
            <p className="text-[11px] text-[var(--color-text-subtle)] mt-0.5">Anualizado: {money(kpis.arrPorMoneda)}</p>
          </div>
          <div className="surface rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-1"><Radio size={13} /> Clientes con monitoreo</div>
            <p className="text-2xl font-bold text-[var(--color-text)]">{kpis.conMonitoreo}</p>
            <p className="text-[11px] text-[var(--color-text-subtle)] mt-0.5">{kpis.activos} abonos activos en total</p>
          </div>
          <div className="surface rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-1"><Building2 size={13} /> Por canal</div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-[var(--color-text)]">
              {Object.keys(kpis.porCanal).length === 0 ? <span className="text-[var(--color-text-subtle)]">—</span> :
                Object.entries(kpis.porCanal).map(([c, n]) => (
                  <span key={c}><span className="font-bold">{n}</span> <span className="text-xs text-[var(--color-text-muted)]">{c}</span></span>
                ))}
            </div>
          </div>
          <div className="surface rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-1"><CalendarClock size={13} /> Contratos por vencer</div>
            <div className="flex gap-3 text-sm text-[var(--color-text)]">
              <span><span className="font-bold">{kpis.renovaciones.d30}</span> <span className="text-xs text-[var(--color-text-muted)]">30d</span></span>
              <span><span className="font-bold">{kpis.renovaciones.d60}</span> <span className="text-xs text-[var(--color-text-muted)]">60d</span></span>
              <span><span className="font-bold">{kpis.renovaciones.d90}</span> <span className="text-xs text-[var(--color-text-muted)]">90d</span></span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)] pointer-events-none" />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Buscar por servicio o empresa…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
        </div>
        <Select className="w-40" value={estado} onChange={e => setEstado(e.target.value)}
          options={[{ value: '', label: 'Todos los estados' }, ...ESTADO_OPTIONS]} />
        <Select className="w-36" value={canal} onChange={e => setCanal(e.target.value)}
          options={[{ value: '', label: 'Todo canal' }, ...CANAL_OPTIONS.map(c => ({ value: c, label: c }))]} />
        <Select className="w-32" value={moneda} onChange={e => setMoneda(e.target.value)}
          options={[{ value: '', label: 'Toda moneda' }, ...MONEDAS_VALIDAS.map(m => ({ value: m, label: m }))]} />
        <Select className="w-44" value={monitoreo} onChange={e => setMonitoreo(e.target.value)}
          options={[{ value: '', label: 'Con y sin monitoreo' }, { value: 'true', label: 'Solo con monitoreo' }, { value: 'false', label: 'Sin monitoreo' }]} />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : isError ? (
        <div className="surface rounded-2xl p-8 text-center text-sm text-red-400 flex items-center justify-center gap-2">
          <AlertTriangle size={15} /> No se pudieron cargar los servicios.
        </div>
      ) : rows.length === 0 ? (
        <div className="surface rounded-2xl p-10 text-center">
          <RefreshCw size={26} className="mx-auto mb-3 text-[var(--color-text-subtle)] opacity-50" />
          <p className="text-sm text-[var(--color-text-muted)]">
            {(data?.data.length ?? 0) === 0 ? 'Todavía no cargaste ningún servicio recurrente.' : 'Ningún servicio coincide con el filtro.'}
          </p>
          {(data?.data.length ?? 0) === 0 && (
            <Button size="sm" className="mt-4" leftIcon={<Plus size={14} />} onClick={() => { setEditing(null); setFormOpen(true) }}>
              Cargar el primero
            </Button>
          )}
        </div>
      ) : (
        <div className="surface rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--color-text-subtle)] border-b border-[var(--color-border)]">
                  <th className="px-4 py-3 font-semibold">Empresa</th>
                  <th className="px-4 py-3 font-semibold">Servicio</th>
                  <th className="px-4 py-3 font-semibold">Monto</th>
                  <th className="px-4 py-3 font-semibold">Canal</th>
                  <th className="px-4 py-3 font-semibold">Contrato</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map(s => (
                  <tr key={s.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-raised)] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/empresas/${s.empresaId}`} className="font-medium text-[var(--color-text)] hover:text-[var(--color-primary)]">
                        {s.empresa?.name ?? '—'}
                      </Link>
                      {s.empresa && !s.empresa.isCliente && (
                        <span className="block text-[10px] text-amber-500">no marcada como cliente</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[var(--color-text)]">{s.nombre}</span>
                      <span className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {s.incluyeMonitoreo && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500"><Radio size={10} /> monitoreo</span>
                        )}
                        {s.modoLicencia !== 'NINGUNA' && (
                          <span className="text-[10px] text-[var(--color-text-subtle)]">{MODO_LICENCIA_LABEL[s.modoLicencia]}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-[var(--color-text)]">{formatCurrency(s.monto, s.moneda)}</span>
                      <span className="block text-[11px] text-[var(--color-text-subtle)]">{s.cicloLabel ?? s.ciclo}</span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{s.canalIngreso}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[var(--color-text-muted)]">
                      {s.contratoFin
                        ? <>
                            {new Date(s.contratoFin).toLocaleDateString('es-AR')}
                            {typeof s.diasHastaFin === 'number' && s.diasHastaFin >= 0 && s.diasHastaFin <= 60 && (
                              <span className="block text-[10px] text-amber-500">vence en {s.diasHastaFin}d</span>
                            )}
                            {typeof s.diasHastaFin === 'number' && s.diasHastaFin < 0 && (
                              <span className="block text-[10px] text-red-400">vencido</span>
                            )}
                          </>
                        : <span className="text-[var(--color-text-subtle)]">sin fin</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={ESTADO_VARIANT[s.estado] ?? 'neutral'} size="sm">{ESTADO_LABEL[s.estado] ?? s.estado}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setEditing(s); setFormOpen(true) }}
                          className="p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10" title="Editar">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleting(s)}
                          className="p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-red-400 hover:bg-red-500/10" title="Borrar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ServicioForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={refresh}
        servicio={editing}
      />

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Borrar servicio" size="sm">
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          ¿Borrar <strong className="text-[var(--color-text)]">{deleting?.nombre}</strong> de {deleting?.empresa?.name}?
          Las facturas que ya se emitieron quedan intactas.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleting(null)}>Cancelar</Button>
          <Button variant="danger" loading={delLoading} onClick={handleDelete}>Borrar</Button>
        </div>
      </Modal>

      <GenerarFacturasModal open={genOpen} onClose={() => setGenOpen(false)} onDone={refresh} />
    </div>
  )
}

// ── Modal: generar facturas de abonos pendientes este mes ────────────────────
function GenerarFacturasModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false)
  const { data, isLoading } = useQuery<{ data: {
    items: { empresa: string; concepto: string; amount: number; currency: string }[]
    skippedEmpresaNoCliente: number
  } }>({
    queryKey: ['abonos-generar-preview'],
    queryFn: async () => {
      const r = await fetch('/api/servicios-recurrentes/generar')
      if (!r.ok) throw new Error()
      return r.json()
    },
    enabled: open, staleTime: 0,
  })
  const items = data?.data.items ?? []
  const noCliente = data?.data.skippedEmpresaNoCliente ?? 0

  const generar = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/servicios-recurrentes/generar', { method: 'POST' })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error || 'Error'); return }
      toast.success(j.message)
      onDone()
      onClose()
    } catch { toast.error('Error de conexión') } finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Generar facturas de abonos" size="md">
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <div className="space-y-3">
          <div className="text-center py-6">
            <FileText size={28} className="text-emerald-400 mx-auto mb-3" />
            <p className="font-medium text-[var(--color-text)]">No hay abonos pendientes</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Todo lo que correspondía este mes ya está facturado.</p>
          </div>
          {noCliente > 0 && (
            <p className="text-xs text-amber-500 flex items-start gap-1.5">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {noCliente} abono{noCliente !== 1 ? 's' : ''} no se factura{noCliente !== 1 ? 'n' : ''} porque su empresa no está marcada como cliente.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">Se van a crear {items.length} factura{items.length !== 1 ? 's' : ''} en estado <strong>Pendiente</strong>:</p>
          {noCliente > 0 && (
            <p className="text-xs text-amber-500 flex items-start gap-1.5">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {noCliente} más no se factura{noCliente !== 1 ? 'n' : ''}: su empresa no está marcada como cliente.
            </p>
          )}
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {items.map((it, i) => (
              <div key={i} className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-[var(--color-border)]">
                <div className="min-w-0">
                  <p className="text-sm text-[var(--color-text)] truncate">{it.empresa}</p>
                  <p className="text-xs text-[var(--color-text-subtle)] truncate">{it.concepto}</p>
                </div>
                <span className="text-sm font-semibold text-[var(--color-text)] shrink-0">{formatCurrency(it.amount, it.currency)}</span>
              </div>
            ))}
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button loading={loading} onClick={generar} leftIcon={<FileText size={14} />}>Generar {items.length} factura{items.length !== 1 ? 's' : ''}</Button>
          </ModalFooter>
        </div>
      )}
    </Modal>
  )
}
