'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  RefreshCw, Plus, Search, Shield, Radio, Pencil, Trash2, AlertTriangle,
  TrendingUp, CalendarClock, Building2, FileText, DollarSign, Users, Hash,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ServicioForm } from '@/components/servicios/servicio-form'
import { formatCurrency } from '@/lib/utils'
import { ESTADO_OPTIONS, ESTADO_LABEL, CANAL_OPTIONS, MONEDAS_VALIDAS, MODO_LICENCIA_LABEL, AJUSTE_CADA_MESES_OPTIONS } from '@/lib/servicios-recurrentes'
import { fmtDateOnly, daysUntilDateOnly } from '@/lib/timezone'
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
interface AjusteGrupo { cadaMeses: number; proximoAjuste: string; vencido: boolean; ultimoAjusteAt: string | null; ultimoAjustePct: number | null }
interface Grupo { nombre: string; moneda: string; clientes: number; mrr: number; min: number; max: number; ciclo: string; ajuste: AjusteGrupo | null }
interface ListResponse { data: ServicioRecurrente[]; kpis: Kpis; agrupado: Grupo[] }

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
  // ADMINISTRATIVO ya tiene permiso real a nivel API (puedeVerServicios, ver
  // src/lib/finance-access.ts) -- acá faltaba sumarlo, esta pantalla ni
  // siquiera cargaba los datos para ese rol aunque tuviera el módulo prendido.
  const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'ADMINISTRATIVO')

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
  // ?ajustar=nombre::moneda — llegada desde la campanita ("Toca ajustar…").
  const searchParams = useSearchParams()
  const [bulkKey, setBulkKey] = useState<string | null>(() => searchParams.get('ajustar'))
  const [bulkOpen, setBulkOpen] = useState(() => !!searchParams.get('ajustar'))
  useEffect(() => {
    const k = searchParams.get('ajustar')
    if (k) { setBulkKey(k); setBulkOpen(true) }
  }, [searchParams])
  const openBulk = (key: string | null = null) => { setBulkKey(key); setBulkOpen(true) }

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
      s.nombre.toLowerCase().includes(term) || (s.empresa?.name ?? '').toLowerCase().includes(term)
      || (s.numeroAbonado ?? '').toLowerCase().includes(term))
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
          <Button variant="outline" size="sm" leftIcon={<DollarSign size={14} />} onClick={() => openBulk()}>
            Ajustar precio / IPC
          </Button>
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

      {/* Ajustes por inflación programados (AjusteAbono) — el "che, subí
          el abono" que pidió Seba. Tocar uno abre el ajuste ya elegido. */}
      {(data?.agrupado ?? []).some((g) => g.ajuste) && (
        <div className="surface rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-2">
            <CalendarClock size={13} /> Ajustes de precio programados
          </div>
          <div className="flex flex-wrap gap-2">
            {(data?.agrupado ?? []).filter((g) => g.ajuste).map((g) => {
              const a = g.ajuste!
              const key = `${g.nombre}::${g.moneda}`
              const dias = daysUntilDateOnly(a.proximoAjuste)
              return (
                <button
                  key={key}
                  onClick={() => openBulk(key)}
                  className="rounded-xl px-3 py-2 text-left border transition-colors hover:border-[var(--color-primary)]"
                  style={a.vencido
                    ? { borderColor: 'rgba(245,158,11,0.5)', background: 'rgba(245,158,11,0.08)' }
                    : { borderColor: 'var(--color-border)' }}
                >
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    {g.nombre} <span className="text-[11px] text-[var(--color-text-subtle)]">{g.moneda} · {g.clientes} cliente{g.clientes !== 1 ? 's' : ''}</span>
                  </p>
                  <p className={`text-[11px] ${a.vencido ? 'text-amber-500 font-semibold' : 'text-[var(--color-text-subtle)]'}`}>
                    {a.vencido
                      ? `Toca ajustar (desde el ${fmtDateOnly(a.proximoAjuste)}) — tocá para aplicarlo`
                      : `Próximo ajuste: ${fmtDateOnly(a.proximoAjuste)} · en ${dias} día${dias !== 1 ? 's' : ''}`}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)] pointer-events-none" />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Buscar por servicio, empresa o N° de abonado…"
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
                        {s.numeroAbonado && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--color-text-muted)]" title="N° de abonado (Ultra)">
                            <Hash size={10} />{s.numeroAbonado}
                          </span>
                        )}
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
      <BulkPriceModal
        key={bulkKey ?? 'manual'}
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onDone={refresh}
        agrupado={data?.agrupado ?? []}
        initialKey={bulkKey}
      />
    </div>
  )
}

// ── Modal: ajustar el precio de un servicio para TODOS los clientes que lo
// tienen activo (pedido de Abba: el abono se re-precia trimestralmente y no
// quieren editar cliente por cliente). Desde 22/10 también por % (IPC) y con
// aviso programado para el próximo ajuste (Seba: "que me deje poner el % del
// IPC y suba, a los tres meses de nuevo") ──────────────────────────────────
type ModoAjuste = 'porcentaje' | 'monto' | 'solo_aviso'

const MODO_AJUSTE_OPTIONS: { value: ModoAjuste; label: string }[] = [
  { value: 'porcentaje', label: 'Subir un % (IPC)' },
  { value: 'monto', label: 'Precio nuevo' },
  { value: 'solo_aviso', label: 'Sólo programar aviso' },
]

function redondearPreview(monto: number, moneda: string) {
  return moneda === 'ARS' ? Math.round(monto) : Math.round(monto * 100) / 100
}

function BulkPriceModal({ open, onClose, onDone, agrupado, initialKey }: {
  open: boolean; onClose: () => void; onDone: () => void; agrupado: Grupo[]; initialKey?: string | null
}) {
  const [selected, setSelected] = useState<string>('') // "nombre::moneda"
  const [modo, setModo] = useState<ModoAjuste>('porcentaje')
  const [monto, setMonto] = useState('')
  const [porcentaje, setPorcentaje] = useState('')
  const [aviso, setAviso] = useState('3') // '0' = no avisar
  const [actualizarCatalogo, setActualizarCatalogo] = useState(true)
  const [loading, setLoading] = useState(false)

  const grupo = agrupado.find((g) => `${g.nombre}::${g.moneda}` === selected) ?? null

  const pick = (key: string) => {
    setSelected(key)
    const g = agrupado.find((x) => `${x.nombre}::${x.moneda}` === key)
    setMonto(g && g.min === g.max ? String(g.min) : '')
    setAviso(String(g?.ajuste?.cadaMeses ?? 3))
  }

  // Llegada desde la campanita ("Toca ajustar…" → /servicios?ajustar=…).
  useEffect(() => {
    if (open && initialKey && !selected && agrupado.some((g) => `${g.nombre}::${g.moneda}` === initialKey)) pick(initialKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialKey, agrupado])

  const pct = Number(porcentaje.replace(',', '.'))
  const pctOk = Number.isFinite(pct) && pct !== 0 && pct > -90 && pct <= 300
  const montoOk = Number.isFinite(Number(monto)) && Number(monto) > 0
  const puede = !!grupo && (modo === 'porcentaje' ? pctOk : modo === 'monto' ? montoOk : aviso !== '0')

  const confirmar = async () => {
    if (!grupo || !puede) return
    setLoading(true)
    try {
      const r = await fetch('/api/servicios-recurrentes/bulk-update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: grupo.nombre, moneda: grupo.moneda, modo,
          ...(modo === 'monto' ? { monto: Number(monto) } : {}),
          ...(modo === 'porcentaje' ? { porcentaje: pct } : {}),
          avisoCadaMeses: Number(aviso),
          actualizarCatalogo,
        }),
      })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error || 'No se pudo actualizar'); return }
      const proximo = j.proximoAjuste ? ` Próximo aviso: ${fmtDateOnly(j.proximoAjuste)}.` : ''
      toast.success(modo === 'solo_aviso'
        ? `Aviso programado.${proximo}`
        : `Precio actualizado en ${j.updated} cliente${j.updated !== 1 ? 's' : ''}.${proximo}`, { duration: 6000 })
      onDone()
      onClose()
      setSelected(''); setMonto(''); setPorcentaje(''); setModo('porcentaje')
    } catch { toast.error('Error de conexión') } finally { setLoading(false) }
  }

  const rango = (min: number, max: number, moneda: string) =>
    min === max ? formatCurrency(min, moneda) : `entre ${formatCurrency(min, moneda)} y ${formatCurrency(max, moneda)}`

  return (
    <Modal open={open} onClose={onClose} title="Ajustar precio / IPC" size="sm">
      <div className="space-y-4">
        <p className="text-xs text-[var(--color-text-muted)]">
          Se aplica de una sola vez a <strong>todos los clientes que tienen el servicio activo</strong> hoy — no toca a los pausados/de baja.
        </p>
        {agrupado.length === 0 ? (
          <p className="text-sm text-[var(--color-text-subtle)]">No hay servicios activos para ajustar.</p>
        ) : (
          <>
            <Select
              label="Servicio"
              value={selected}
              onChange={(e) => pick(e.target.value)}
              options={[
                { value: '', label: '— elegir —' },
                ...agrupado.map((g) => ({
                  value: `${g.nombre}::${g.moneda}`,
                  label: `${g.nombre} (${g.moneda}) — ${g.clientes} cliente${g.clientes !== 1 ? 's' : ''}`,
                })),
              ]}
            />
            {grupo && (
              <>
                <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5">
                  <Users size={12} />
                  Precio actual: {rango(grupo.min, grupo.max, grupo.moneda)}
                  {grupo.ajuste?.ultimoAjusteAt && (
                    <span className="text-[var(--color-text-subtle)]">
                      · último ajuste {new Date(grupo.ajuste.ultimoAjusteAt).toLocaleDateString('es-AR')}
                      {grupo.ajuste.ultimoAjustePct != null ? ` (${grupo.ajuste.ultimoAjustePct}%)` : ''}
                    </span>
                  )}
                </div>

                <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--color-surface-raised)' }}>
                  {MODO_AJUSTE_OPTIONS.map((o) => (
                    <button
                      key={o.value} type="button" onClick={() => setModo(o.value)}
                      className="flex-1 text-xs font-medium py-1.5 rounded-md transition-colors"
                      style={modo === o.value ? { background: 'var(--color-surface)', color: 'var(--color-text)' } : { color: 'var(--color-text-muted)' }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>

                {modo === 'porcentaje' && (
                  <div>
                    <label className="text-sm font-semibold text-[var(--color-text-muted)] block mb-1.5">% de aumento (ej. IPC del trimestre)</label>
                    <input
                      type="text" inputMode="decimal" placeholder="Ej: 8,5" value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                    />
                    {pctOk && (
                      <p className="text-xs mt-1.5 text-[var(--color-text)]">
                        {rango(grupo.min, grupo.max, grupo.moneda)} → <strong>{rango(redondearPreview(grupo.min * (1 + pct / 100), grupo.moneda), redondearPreview(grupo.max * (1 + pct / 100), grupo.moneda), grupo.moneda)}</strong>
                        <span className="block text-[11px] text-[var(--color-text-subtle)]">Cada cliente sube sobre lo que paga hoy (si alguno paga distinto, se respeta).</span>
                      </p>
                    )}
                  </div>
                )}

                {modo === 'monto' && (
                  <div>
                    <label className="text-sm font-semibold text-[var(--color-text-muted)] block mb-1.5">Precio nuevo ({grupo.moneda}) — igual para todos</label>
                    <input
                      type="number" min={0} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                    />
                  </div>
                )}

                {modo !== 'solo_aviso' && (
                  <label className="flex items-start gap-2 cursor-pointer text-xs text-[var(--color-text-muted)]">
                    <input type="checkbox" checked={actualizarCatalogo} onChange={(e) => setActualizarCatalogo(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[var(--color-primary)]" />
                    <span>Actualizar también el precio en el catálogo de Servicios (así los abonos nuevos salen con el precio nuevo)</span>
                  </label>
                )}

                <div>
                  <Select
                    label="Avisarme del próximo ajuste"
                    value={aviso}
                    onChange={(e) => setAviso(e.target.value)}
                    options={[...AJUSTE_CADA_MESES_OPTIONS, { value: '0', label: 'No avisar' }]}
                  />
                  <p className="text-[11px] mt-1 text-[var(--color-text-subtle)]">
                    {aviso === '0'
                      ? 'No va a aparecer ningún recordatorio para este servicio.'
                      : `Ese día aparece en la campanita del CRM y acá arriba. No sube nada solo: el % lo ponés vos.`}
                  </p>
                </div>
              </>
            )}
            <ModalFooter>
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button loading={loading} disabled={!puede} onClick={confirmar} leftIcon={<DollarSign size={14} />}>
                {modo === 'solo_aviso' ? 'Programar aviso' : `Aplicar a ${grupo?.clientes ?? 0} cliente${(grupo?.clientes ?? 0) !== 1 ? 's' : ''}`}
              </Button>
            </ModalFooter>
          </>
        )}
      </div>
    </Modal>
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
