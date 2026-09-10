'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  CICLO_OPTIONS, ESTADO_OPTIONS, MODO_LICENCIA_OPTIONS, CANAL_OPTIONS, MONEDAS_VALIDAS,
} from '@/lib/servicios-recurrentes'
import type { ServicioRecurrente } from '@/types'
import toast from 'react-hot-toast'

interface EmpresaOption { id: string; name: string }
interface CatalogoServicio { id: string; name: string; price: number; currency: string; billingCycle: string }

// Catálogo de Servicios (para el Cotizador) → ciclo de abono. El abono queda
// independiente: esto sólo pre-llena para no re-tipear.
const BILLING_CYCLE_A_CICLO: Record<string, string> = {
  MONTHLY: 'MENSUAL', QUARTERLY: 'TRIMESTRAL', ANNUAL: 'ANUAL', ONE_TIME: 'UNICO',
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** Editar uno existente. */
  servicio?: ServicioRecurrente | null
  /** Precargar la empresa (desde la ficha de una empresa). */
  empresaId?: string
  empresaNombre?: string
}

type FormState = {
  empresaId: string
  nombre: string
  monto: string
  moneda: string
  ciclo: string
  diaVencimiento: string
  modoLicencia: string
  incluyeMonitoreo: boolean
  canalIngreso: string
  contratoInicio: string
  contratoFin: string
  estado: string
  serial: string
  version: string
  puestos: string
  notas: string
}

const EMPTY: FormState = {
  empresaId: '', nombre: '', monto: '', moneda: 'USD', ciclo: 'MENSUAL', diaVencimiento: '10',
  modoLicencia: 'NINGUNA', incluyeMonitoreo: false, canalIngreso: 'CRM',
  contratoInicio: '', contratoFin: '', estado: 'ACTIVO',
  serial: '', version: '', puestos: '', notas: '',
}

const isoToDateInput = (v: string | null) => (v ? v.slice(0, 10) : '')

export function ServicioForm({ open, onClose, onSaved, servicio, empresaId, empresaNombre }: Props) {
  const editing = !!servicio
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [showLicencia, setShowLicencia] = useState(false)

  const { data: empresas } = useQuery<EmpresaOption[]>({
    queryKey: ['empresas-options'],
    queryFn: async () => {
      const r = await fetch('/api/empresas/options')
      if (!r.ok) return []
      return ((await r.json()).data ?? []) as EmpresaOption[]
    },
    enabled: open && !editing && !empresaId,
    staleTime: 60_000,
  })

  // Catálogo de Servicios (el mismo que usa el Cotizador) — para pre-llenar
  // el abono y no re-tipear nombre/monto/moneda/ciclo.
  const { data: catalogo } = useQuery<CatalogoServicio[]>({
    queryKey: ['servicios-catalogo'],
    queryFn: async () => {
      const r = await fetch('/api/services')
      if (!r.ok) return []
      return ((await r.json()).data ?? []) as CatalogoServicio[]
    },
    enabled: open && !editing,
    staleTime: 60_000,
  })

  const aplicarDelCatalogo = (id: string) => {
    const s = (catalogo ?? []).find((x) => x.id === id)
    if (!s) return
    setForm((f) => ({
      ...f,
      nombre: s.name,
      monto: String(s.price ?? ''),
      moneda: MONEDAS_VALIDAS.includes(s.currency) ? s.currency : f.moneda,
      ciclo: BILLING_CYCLE_A_CICLO[s.billingCycle] ?? f.ciclo,
    }))
  }

  useEffect(() => {
    if (!open) return
    if (servicio) {
      setForm({
        empresaId: servicio.empresaId,
        nombre: servicio.nombre,
        monto: String(servicio.monto ?? ''),
        moneda: servicio.moneda || 'USD',
        ciclo: servicio.ciclo,
        diaVencimiento: String(servicio.diaVencimiento ?? 10),
        modoLicencia: servicio.modoLicencia,
        incluyeMonitoreo: servicio.incluyeMonitoreo,
        canalIngreso: servicio.canalIngreso || 'CRM',
        contratoInicio: isoToDateInput(servicio.contratoInicio),
        contratoFin: isoToDateInput(servicio.contratoFin),
        estado: servicio.estado,
        serial: servicio.serial ?? '',
        version: servicio.version ?? '',
        puestos: servicio.puestos != null ? String(servicio.puestos) : '',
        notas: servicio.notas ?? '',
      })
      setShowLicencia(!!(servicio.serial || servicio.version || servicio.puestos != null))
    } else {
      setForm({ ...EMPTY, empresaId: empresaId ?? '' })
      setShowLicencia(false)
    }
  }, [open, servicio, empresaId])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.empresaId) { toast.error('Elegí la empresa'); return }
    if (!form.nombre.trim()) { toast.error('Poné un nombre para el servicio'); return }
    const monto = Number(form.monto)
    if (!Number.isFinite(monto) || monto < 0) { toast.error('El monto no es válido'); return }
    if (form.contratoInicio && form.contratoFin && form.contratoFin < form.contratoInicio) {
      toast.error('El fin de contrato no puede ser anterior al inicio'); return
    }

    setSaving(true)
    try {
      const payload = {
        empresaId: form.empresaId,
        nombre: form.nombre.trim(),
        monto,
        moneda: form.moneda,
        ciclo: form.ciclo,
        diaVencimiento: Number(form.diaVencimiento) || 10,
        modoLicencia: form.modoLicencia,
        incluyeMonitoreo: form.incluyeMonitoreo,
        canalIngreso: form.canalIngreso,
        contratoInicio: form.contratoInicio || null,
        contratoFin: form.contratoFin || null,
        estado: form.estado,
        serial: form.serial.trim() || null,
        version: form.version.trim() || null,
        puestos: form.puestos === '' ? null : Number(form.puestos),
        notas: form.notas.trim() || null,
      }
      const res = await fetch(
        editing ? `/api/servicios-recurrentes/${servicio!.id}` : '/api/servicios-recurrentes',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'No se pudo guardar'); return }
      toast.success(editing ? 'Servicio actualizado' : 'Servicio creado')
      onSaved()
      onClose()
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  const empresaOptions = [
    { value: '', label: '— elegí la empresa —' },
    ...(empresas ?? []).map(e => ({ value: e.id, label: e.name })),
  ]

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar servicio' : 'Nuevo servicio recurrente'} size="lg">
      <div className="space-y-4">
        {editing || empresaId ? (
          <div>
            <label className="text-sm font-medium text-[var(--color-text-muted)]">Empresa</label>
            <p className="text-sm text-[var(--color-text)] mt-1">{empresaNombre || servicio?.empresa?.name || '—'}</p>
          </div>
        ) : (
          <Select label="Empresa" value={form.empresaId} onChange={e => set('empresaId', e.target.value)} options={empresaOptions} />
        )}

        {!editing && (catalogo?.length ?? 0) > 0 && (
          <div>
            <Select
              label="Partir de un servicio del catálogo (opcional)"
              value=""
              onChange={e => { if (e.target.value) aplicarDelCatalogo(e.target.value) }}
              options={[
                { value: '', label: '— cargar los datos a mano —' },
                ...(catalogo ?? []).map(s => ({ value: s.id, label: `${s.name} — ${s.currency} ${s.price}` })),
              ]}
            />
            <p className="text-xs mt-1 text-[var(--color-text-subtle)]">
              Copia nombre, monto, moneda y ciclo. Después lo podés ajustar — el abono queda independiente del catálogo.
            </p>
          </div>
        )}

        <Input
          label="Nombre del servicio"
          placeholder="Ej: Monitoreo 24hs, Licencia SoftGuard SaaS, Mantenimiento…"
          value={form.nombre}
          onChange={e => set('nombre', e.target.value)}
        />

        {/* ── Facturación ── */}
        <div className="grid sm:grid-cols-3 gap-3">
          <Input label="Monto (sin IVA)" type="number" min="0" step="0.01" value={form.monto} onChange={e => set('monto', e.target.value)} placeholder="0.00" />
          <Select label="Moneda" value={form.moneda} onChange={e => set('moneda', e.target.value)}
            options={MONEDAS_VALIDAS.map(m => ({ value: m, label: m }))} />
          <Select label="Ciclo" value={form.ciclo} onChange={e => set('ciclo', e.target.value)} options={CICLO_OPTIONS} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Día de vencimiento" type="number" min="1" max="28" value={form.diaVencimiento} onChange={e => set('diaVencimiento', e.target.value)} hint="Día del mes siguiente en que vence la factura (1–28)" />
          <Select label="Estado" value={form.estado} onChange={e => set('estado', e.target.value)} options={ESTADO_OPTIONS} />
        </div>

        {/* ── Contrato / clasificación ── */}
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Inicio de contrato (opcional)" type="date" value={form.contratoInicio} onChange={e => set('contratoInicio', e.target.value)} />
          <Input label="Fin de contrato (opcional)" type="date" value={form.contratoFin} onChange={e => set('contratoFin', e.target.value)} hint="Vacío = renovación automática" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Select label="Modo de licencia" value={form.modoLicencia} onChange={e => set('modoLicencia', e.target.value)} options={MODO_LICENCIA_OPTIONS} />
          <Select label="Canal de ingreso" value={form.canalIngreso} onChange={e => set('canalIngreso', e.target.value)}
            options={CANAL_OPTIONS.map(c => ({ value: c, label: c }))} />
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={form.incluyeMonitoreo} onChange={e => set('incluyeMonitoreo', e.target.checked)} className="w-4 h-4 accent-[var(--color-primary)]" />
          <span className="text-sm text-[var(--color-text)]">Este servicio incluye monitoreo</span>
        </label>

        {/* ── Datos de licencia (opcional) ── */}
        <button type="button" onClick={() => setShowLicencia(s => !s)} className="text-xs text-[var(--color-primary)] hover:underline">
          {showLicencia ? '− Ocultar' : '+ Agregar'} datos de licencia (serial, versión, puestos)
        </button>
        {showLicencia && (
          <div className="grid sm:grid-cols-3 gap-3">
            <Input label="Serial" value={form.serial} onChange={e => set('serial', e.target.value)} />
            <Input label="Versión" value={form.version} onChange={e => set('version', e.target.value)} />
            <Input label="Puestos" type="number" min="0" value={form.puestos} onChange={e => set('puestos', e.target.value)} />
          </div>
        )}

        <Textarea label="Notas (opcional)" rows={2} value={form.notas} onChange={e => set('notas', e.target.value)} />

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} loading={saving}>{editing ? 'Guardar cambios' : 'Crear servicio'}</Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}
