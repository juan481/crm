'use client'

// Gastos del día a día — pedido de Abba (Seba, 25/10): "¿cómo cargo gastos
// diarios? algo rápido y sencillo, y que después de la primera carga ya
// quede registrado el proveedor". Un renglón de carga arriba (Enter guarda y
// deja la fecha para seguir cargando), la lista del mes abajo. Elegir un
// proveedor ya usado completa solo la categoría, el medio de pago y la
// moneda de su último gasto. Uno nuevo se crea solo como proveedor.

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Receipt, Paperclip, Trash2, ChevronLeft, ChevronRight, AlertTriangle, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useModuleAccess } from '@/hooks/use-module-access'
import { useAuthStore } from '@/store/auth-store'
import { formatCurrency } from '@/lib/utils'
import { argentinaDayKey, fmtDateOnly } from '@/lib/timezone'
import { CATEGORIAS_GASTO, MEDIOS_PAGO_GASTO, MEDIO_PAGO_GASTO_LABEL, MONEDAS_GASTO } from '@/lib/gastos'
import toast from 'react-hot-toast'

interface Gasto {
  id: string
  fecha: string
  categoria: string
  concepto: string | null
  monto: number
  moneda: string
  medioPago: string | null
  comprobanteUrl: string | null
  creadoPorId: string | null
  proveedor: { id: string; name: string } | null
  creadoPor: { name: string } | null
}
interface Proveedor { id: string; name: string; ultimaCategoria: string | null; ultimoMedioPago: string | null; ultimaMoneda: string | null }
interface Resp {
  mes: string
  data: Gasto[]
  totales: { porMoneda: Record<string, number>; porCategoria: Record<string, Record<string, number>> }
  proveedores: Proveedor[]
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function moverMes(mes: string, delta: number): string {
  const [y, m] = mes.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

// "45.000", "45.000,50", "45000.5", "45000" — se tipea como venga.
// Con coma: el punto es de miles. Sin coma: un punto seguido de exactamente
// 3 dígitos es de miles ("45.000"); si no, es decimal ("45000.5").
function parseMonto(raw: string): number {
  const s = raw.replace(/[^\d.,]/g, '')
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'))
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''))
  return Number(s)
}

function money(v: number, moneda: string) {
  return formatCurrency(v, moneda, moneda === 'USD' ? 2 : 0)
}

function etiquetaDia(fecha: string, hoy: string): string {
  if (fecha === hoy) return 'Hoy'
  const [y, m, d] = hoy.split('-').map(Number)
  const ayer = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
  return fecha === ayer ? 'Ayer' : fmtDateOnly(fecha)
}

const inputCls = 'w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30'

export default function GastosPage() {
  const qc = useQueryClient()
  const allowed = useModuleAccess('gastos')
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
  const hoy = argentinaDayKey()

  const [mes, setMes] = useState(hoy.slice(0, 7))
  const [fecha, setFecha] = useState(hoy)
  const [proveedor, setProveedor] = useState('')
  const [categoria, setCategoria] = useState('')
  const [monto, setMonto] = useState('')
  const [moneda, setMoneda] = useState('ARS')
  const [medioPago, setMedioPago] = useState('EFECTIVO')
  const [concepto, setConcepto] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [borrando, setBorrando] = useState<string | null>(null)
  const proveedorRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data, isLoading, isError } = useQuery<Resp>({
    queryKey: ['gastos', mes],
    queryFn: async () => {
      const r = await fetch(`/api/gastos?mes=${mes}`)
      if (!r.ok) throw new Error((await r.json()).error || 'Error')
      return r.json()
    },
    enabled: allowed === true,
    staleTime: 15_000,
  })
  const proveedores = data?.proveedores ?? []
  const gastos = data?.data ?? []

  const proveedorElegido = proveedores.find((p) => p.name.toLowerCase() === proveedor.trim().toLowerCase()) ?? null
  const proveedorNuevo = !!proveedor.trim() && !proveedorElegido

  // Proveedor conocido → completa lo que se le cargó la última vez.
  const elegirProveedor = (nombre: string) => {
    setProveedor(nombre)
    const p = proveedores.find((x) => x.name.toLowerCase() === nombre.trim().toLowerCase())
    if (!p) return
    if (p.ultimaCategoria) setCategoria(p.ultimaCategoria)
    if (p.ultimoMedioPago) setMedioPago(p.ultimoMedioPago)
    if (p.ultimaMoneda) setMoneda(p.ultimaMoneda)
  }

  const guardar = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const montoNum = parseMonto(monto)
    if (!categoria) { toast.error('Elegí la categoría'); return }
    if (!Number.isFinite(montoNum) || montoNum <= 0) { toast.error('Poné el monto'); return }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.set('fecha', fecha)
      fd.set('categoria', categoria)
      fd.set('monto', String(montoNum))
      fd.set('moneda', moneda)
      fd.set('medioPago', medioPago)
      if (concepto.trim()) fd.set('concepto', concepto.trim())
      if (proveedorElegido) fd.set('proveedorId', proveedorElegido.id)
      else if (proveedor.trim()) fd.set('proveedorNombre', proveedor.trim())
      if (file) fd.set('comprobante', file)
      const r = await fetch('/api/gastos', { method: 'POST', body: fd })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error || 'No se pudo guardar'); return }
      toast.success(proveedorNuevo ? `Gasto cargado — ${proveedor.trim()} quedó guardado como proveedor` : 'Gasto cargado')
      // La fecha queda (se suelen cargar varios del mismo día de una).
      setProveedor(''); setCategoria(''); setMonto(''); setConcepto(''); setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      if (fecha.slice(0, 7) !== mes) setMes(fecha.slice(0, 7))
      qc.invalidateQueries({ queryKey: ['gastos'] })
      if (proveedorNuevo) qc.invalidateQueries({ queryKey: ['empresas'] })
      proveedorRef.current?.focus()
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  const borrar = async (g: Gasto) => {
    if (!confirm(`¿Borrar el gasto de ${money(g.monto, g.moneda)}${g.proveedor ? ` en ${g.proveedor.name}` : ''}?`)) return
    setBorrando(g.id)
    try {
      const r = await fetch(`/api/gastos/${g.id}`, { method: 'DELETE' })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error || 'No se pudo borrar'); return }
      toast.success('Gasto borrado')
      qc.invalidateQueries({ queryKey: ['gastos'] })
    } catch { toast.error('Error de conexión') } finally { setBorrando(null) }
  }

  const porDia = useMemo(() => {
    const m = new Map<string, Gasto[]>()
    for (const g of gastos) m.set(g.fecha, [...(m.get(g.fecha) ?? []), g])
    return Array.from(m.entries())
  }, [gastos])

  const categoriasTop = useMemo(() => Object.entries(data?.totales.porCategoria ?? {})
    .map(([cat, porMon]) => ({ cat, porMon, orden: porMon.ARS ?? 0 }))
    .sort((a, b) => b.orden - a.orden), [data])

  if (allowed === undefined) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
  }
  if (allowed === false) {
    return (
      <div className="surface rounded-2xl p-6 flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
        <AlertTriangle size={16} className="text-amber-500" />
        No tenés permiso para ver Gastos. Pedile a un administrador que te lo habilite en Configuración → Permisos.
      </div>
    )
  }

  const [y, m] = mes.split('-').map(Number)
  const esMesActual = mes === hoy.slice(0, 7)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Gastos</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            Nafta, librería, un service, viáticos… Cargá cada gasto en un renglón. Las facturas de mercadería van en <Link href="/compras" className="underline">Compras</Link>.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMes(moverMes(mes, -1))} className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]" title="Mes anterior"><ChevronLeft size={16} /></button>
          <span className="text-sm font-semibold w-36 text-center capitalize text-[var(--color-text)]">{MESES[m - 1]} {y}</span>
          <button onClick={() => setMes(moverMes(mes, 1))} disabled={esMesActual} className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] disabled:opacity-30" title="Mes siguiente"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Carga rápida */}
      <form onSubmit={guardar} className="surface rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
          <Plus size={15} style={{ color: 'var(--color-primary)' }} /> Cargar un gasto
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-12 gap-2">
          <input type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value || hoy)} className={`${inputCls} col-span-1 lg:col-span-2`} title="Fecha" />
          <div className="col-span-1 lg:col-span-3">
            <input
              ref={proveedorRef}
              list="gastos-proveedores"
              value={proveedor}
              onChange={(e) => elegirProveedor(e.target.value)}
              placeholder="Proveedor (ej: YPF)"
              className={inputCls}
              autoFocus
            />
            <datalist id="gastos-proveedores">
              {proveedores.map((p) => <option key={p.id} value={p.name} />)}
            </datalist>
          </div>
          <div className="col-span-2 lg:col-span-3">
            <Select
              className="py-2.5"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              options={[{ value: '', label: 'Categoría…' }, ...CATEGORIAS_GASTO.map((c) => ({ value: c, label: c }))]}
            />
          </div>
          <input
            inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)}
            placeholder="Monto" className={`${inputCls} col-span-1 lg:col-span-2`}
          />
          <div className="col-span-1 lg:col-span-2">
            <Select className="py-2.5" value={moneda} onChange={(e) => setMoneda(e.target.value)} options={MONEDAS_GASTO.map((c) => ({ value: c, label: c }))} />
          </div>
          <div className="col-span-1 lg:col-span-3">
            <Select className="py-2.5" value={medioPago} onChange={(e) => setMedioPago(e.target.value)} options={MEDIOS_PAGO_GASTO} />
          </div>
          <input
            value={concepto} onChange={(e) => setConcepto(e.target.value)}
            placeholder="Detalle (opcional) — ej: nafta camioneta"
            className={`${inputCls} col-span-1 lg:col-span-6`}
          />
          <div className="col-span-2 lg:col-span-3 flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file ? (
              <span className="flex-1 min-w-0 flex items-center gap-1.5 text-xs px-3 py-2.5 rounded-xl" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text)' }}>
                <Paperclip size={13} className="shrink-0" /><span className="truncate">{file.name}</span>
                <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }} className="ml-auto shrink-0 text-[var(--color-text-subtle)] hover:text-red-400"><X size={13} /></button>
              </span>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2.5 rounded-xl border border-dashed border-[var(--color-border-strong)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                <Paperclip size={13} /> Foto del ticket (opcional)
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-[var(--color-text-subtle)]">
            {proveedorNuevo
              ? <>Proveedor nuevo: <strong className="text-[var(--color-text-muted)]">{proveedor.trim()}</strong> queda guardado en Proveedores para la próxima.</>
              : proveedorElegido
                ? 'Completé categoría y medio de pago con lo de la última vez — cambialos si hace falta.'
                : 'Enter guarda. La fecha queda puesta para seguir cargando los de ese día.'}
          </p>
          <Button type="submit" loading={saving} leftIcon={<Receipt size={14} />}>Guardar gasto</Button>
        </div>
      </form>

      {/* Totales del mes */}
      {!isLoading && !isError && gastos.length > 0 && (
        <div className="surface rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="text-xs text-[var(--color-text-muted)]">Total del mes</span>
            {Object.entries(data?.totales.porMoneda ?? {}).map(([cur, v]) => (
              <span key={cur} className="text-xl font-bold text-[var(--color-text)]">{money(v, cur)}</span>
            ))}
            <span className="text-xs text-[var(--color-text-subtle)]">{gastos.length} gasto{gastos.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {categoriasTop.map(({ cat, porMon }) => (
              <span key={cat} className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                {cat}: <strong className="text-[var(--color-text)]">{Object.entries(porMon).map(([cur, v]) => money(v, cur)).join(' + ')}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Lista del mes */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : isError ? (
        <div className="surface rounded-2xl p-8 text-center text-sm text-red-400 flex items-center justify-center gap-2">
          <AlertTriangle size={15} /> No se pudieron cargar los gastos.
        </div>
      ) : gastos.length === 0 ? (
        <div className="surface rounded-2xl p-10 text-center">
          <Receipt size={26} className="mx-auto mb-3 text-[var(--color-text-subtle)] opacity-50" />
          <p className="text-sm text-[var(--color-text-muted)]">No hay gastos cargados en {MESES[m - 1]}.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {porDia.map(([dia, items]) => (
            <div key={dia} className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">{etiquetaDia(dia, hoy)}</p>
              {items.map((g) => (
                <div key={g.id} className="surface rounded-xl px-3 py-2.5 flex items-center gap-3 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-[var(--color-text)]">
                      {g.proveedor?.name ?? 'Sin proveedor'}
                      {g.concepto && <span className="font-normal text-[var(--color-text-muted)]"> — {g.concepto}</span>}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-subtle)]">
                      {g.categoria}
                      {g.medioPago && ` · ${MEDIO_PAGO_GASTO_LABEL[g.medioPago] ?? g.medioPago}`}
                      {g.creadoPor?.name && ` · cargó ${g.creadoPor.name}`}
                    </p>
                  </div>
                  {g.comprobanteUrl && (
                    <a href={g.comprobanteUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-primary)]" title="Ver comprobante">
                      <Paperclip size={14} />
                    </a>
                  )}
                  <span className="text-sm font-semibold whitespace-nowrap text-[var(--color-text)]">{money(g.monto, g.moneda)}</span>
                  {(isAdmin || g.creadoPorId === user?.id) && (
                    <button onClick={() => borrar(g)} disabled={borrando === g.id}
                      className="p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50" title="Borrar (si está mal, borralo y cargalo de nuevo)">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
