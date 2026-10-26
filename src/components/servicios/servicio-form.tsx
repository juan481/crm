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
import { useAuthStore } from '@/store/auth-store'
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
  medioCobro: string
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
  numeroAbonado: string
}

const EMPTY: FormState = {
  empresaId: '', nombre: '', monto: '', moneda: 'USD', ciclo: 'MENSUAL', diaVencimiento: '10',
  medioCobro: '',
  modoLicencia: 'NINGUNA', incluyeMonitoreo: false, canalIngreso: 'CRM',
  contratoInicio: '', contratoFin: '', estado: 'ACTIVO',
  serial: '', version: '', puestos: '', notas: '', numeroAbonado: '',
}

const MEDIO_COBRO_OPTIONS = [
  { value: '', label: 'Automático (según la moneda)' },
  { value: 'MERCADOPAGO', label: 'Mercado Pago' },
  { value: 'WHOP', label: 'Whop' },
  { value: 'MANUAL', label: 'Transferencia / manual (sin link de pago)' },
]

const isoToDateInput = (v: string | null) => (v ? v.slice(0, 10) : '')

// Contraseña inicial del portal: fácil de dictar por teléfono (sin 0/O/1/l).
function passwordInicial(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function ServicioForm({ open, onClose, onSaved, servicio, empresaId, empresaNombre }: Props) {
  const editing = !!servicio
  const { user } = useAuthStore()
  // Dar acceso al portal es Admin+ (ver /api/empresas/[id]/portal-acceso).
  const puedeDarPortal = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [showLicencia, setShowLicencia] = useState(false)
  // Alta del abonado de monitoreo → usuario del portal en el mismo paso
  // (Seba, 26/10: "cargo los datos + servicio + número que le asigné en la
  // plataforma, y ahí ya me genera el user del portal").
  const [crearPortal, setCrearPortal] = useState(true)
  const [portalPassword, setPortalPassword] = useState('')
  const [portalCreado, setPortalCreado] = useState<{ usuario: string; password: string } | null>(null)

  // Accesos al portal que ya tiene la empresa — para no ofrecer crear uno
  // que ya existe (ese número ya entra).
  const { data: portalUsers } = useQuery<{ numeroAbonado: string | null }[]>({
    queryKey: ['portal-acceso', form.empresaId],
    queryFn: async () => {
      const r = await fetch(`/api/empresas/${form.empresaId}/portal-acceso`)
      if (!r.ok) return []
      return ((await r.json()).data ?? []) as { numeroAbonado: string | null }[]
    },
    enabled: open && puedeDarPortal && !!form.empresaId,
    staleTime: 30_000,
  })
  const abonadoNormalizado = form.numeroAbonado.trim().toUpperCase().replace(/[\s-]+/g, '')
  const yaTienePortal = !!abonadoNormalizado && (portalUsers ?? []).some((u) => u.numeroAbonado === abonadoNormalizado)
  const ofrecerPortal = puedeDarPortal && !!abonadoNormalizado && portalUsers !== undefined && !yaTienePortal

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
    setCrearPortal(true)
    setPortalPassword(passwordInicial())
    setPortalCreado(null)
    if (servicio) {
      setForm({
        empresaId: servicio.empresaId,
        nombre: servicio.nombre,
        monto: String(servicio.monto ?? ''),
        moneda: servicio.moneda || 'USD',
        ciclo: servicio.ciclo,
        diaVencimiento: String(servicio.diaVencimiento ?? 10),
        medioCobro: servicio.medioCobro ?? '',
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
        numeroAbonado: servicio.numeroAbonado ?? '',
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
    // monto <= 0 pasaba (Number('') da 0, que es "finito y no negativo") —
    // reporte de Abba, 2026-10-02: Norma cargó servicios marcados como
    // recurrentes con el campo Monto vacío, quedaron en $0 sin que nada
    // avisara. Un servicio recurrente sin monto real no tiene sentido acá.
    if (!Number.isFinite(monto) || monto <= 0) { toast.error('Ingresá el monto del servicio (tiene que ser mayor a 0)'); return }
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
        medioCobro: form.medioCobro || null,
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
        numeroAbonado: form.numeroAbonado.trim() || null,
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

      // Acceso al portal con el mismo abonado. El abono ya quedó guardado:
      // si esto falla, se avisa y se puede dar a mano desde la ficha.
      if (ofrecerPortal && crearPortal) {
        const nombreEmpresa = empresaNombre || servicio?.empresa?.name || (empresas ?? []).find((e) => e.id === form.empresaId)?.name || abonadoNormalizado
        const r = await fetch(`/api/empresas/${form.empresaId}/portal-acceso`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'abonado', name: nombreEmpresa, numeroAbonado: abonadoNormalizado, password: portalPassword }),
        })
        const pj = await r.json().catch(() => ({}))
        if (r.ok) {
          setPortalCreado({ usuario: pj.data?.numeroAbonado ?? abonadoNormalizado, password: portalPassword })
          return // queda abierto mostrando usuario y contraseña
        }
        toast.error(`El servicio se guardó, pero no se pudo crear el acceso al portal: ${pj.error ?? 'error'}`, { duration: 7000 })
      }
      onClose()
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  // Cerrar después de mostrar las credenciales del portal.
  const cerrar = () => { setPortalCreado(null); onClose() }

  const empresaOptions = [
    { value: '', label: '— elegí la empresa —' },
    ...(empresas ?? []).map(e => ({ value: e.id, label: e.name })),
  ]

  if (portalCreado) {
    const texto = `Acceso al portal de clientes\nUsuario: ${portalCreado.usuario}\nContraseña: ${portalCreado.password}`
    return (
      <Modal open={open} onClose={cerrar} title="Servicio guardado — acceso al portal creado" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">Pasale estos datos al cliente (los de ese abonado entran todos con estos mismos):</p>
          <div className="rounded-xl p-4 font-mono text-sm space-y-1" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text)' }}>
            <p>Usuario: <strong>{portalCreado.usuario}</strong></p>
            <p>Contraseña: <strong>{portalCreado.password}</strong></p>
          </div>
          <p className="text-[11px] text-[var(--color-text-subtle)]">La contraseña no se vuelve a mostrar. Si se la olvidan, se resetea desde la ficha de la empresa → Portal de clientes.</p>
          <ModalFooter>
            <Button variant="ghost" onClick={() => { navigator.clipboard?.writeText(texto).then(() => toast.success('Copiado')).catch(() => {}) }}>Copiar</Button>
            <Button onClick={cerrar}>Listo</Button>
          </ModalFooter>
        </div>
      </Modal>
    )
  }

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

        {/* Pedido de Abba (22/10, migración de CRA): el número de cuenta
            del cliente en el Ultra, para tener todo prolijo y para que el
            portal de clientes entre con ese mismo número. */}
        <Input
          label="N° de abonado (Ultra) — opcional"
          placeholder="Ej: ABB3434"
          value={form.numeroAbonado}
          onChange={e => set('numeroAbonado', e.target.value.toUpperCase().replace(/[\s-]+/g, ''))}
          hint="El código del abonado en el Ultra: letras del dealer + número (ej. ABB3434)."
        />

        {/* ── Facturación ── */}
        <div className="grid sm:grid-cols-3 gap-3">
          <Input label="Monto (sin IVA)" type="number" min="0" step="0.01" value={form.monto} onChange={e => set('monto', e.target.value)} placeholder="0.00" />
          <Select label="Moneda" value={form.moneda} onChange={e => set('moneda', e.target.value)}
            options={MONEDAS_VALIDAS.map(m => ({ value: m, label: m }))} />
          <Select label="Ciclo" value={form.ciclo} onChange={e => set('ciclo', e.target.value)} options={CICLO_OPTIONS} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Día de vencimiento" type="number" min="1" max="28" value={form.diaVencimiento} onChange={e => set('diaVencimiento', e.target.value)} hint="Día en que vence la factura (1–28)" />
          <Select label="Estado" value={form.estado} onChange={e => set('estado', e.target.value)} options={ESTADO_OPTIONS} />
        </div>
        <div>
          <Select
            label="Medio de cobro"
            value={form.medioCobro}
            onChange={e => set('medioCobro', e.target.value)}
            options={MEDIO_COBRO_OPTIONS}
          />
          <p className="text-xs mt-1 text-[var(--color-text-subtle)]">
            Por dónde se le cobra al cliente. Queda registrado en cada factura y en las notas de la empresa.
          </p>
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

        {/* Usuario del portal con el mismo abonado del Ultra — sólo si
            todavía no existe uno con ese número. */}
        {ofrecerPortal && (
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={crearPortal} onChange={e => setCrearPortal(e.target.checked)} className="w-4 h-4 accent-[var(--color-primary)]" />
              <span className="text-sm font-medium text-[var(--color-text)]">Crear el acceso al portal con el abonado {abonadoNormalizado}</span>
            </label>
            {crearPortal && (
              <Input
                label="Contraseña inicial (podés poner el DNI del cliente)"
                value={portalPassword}
                onChange={e => setPortalPassword(e.target.value)}
                hint={`Entran con ${abonadoNormalizado} (o el número solo) y esta contraseña. Un acceso por abonado: lo usan todos los de ese abonado.`}
              />
            )}
          </div>
        )}
        {puedeDarPortal && yaTienePortal && (
          <p className="text-xs text-[var(--color-text-subtle)]">El abonado {abonadoNormalizado} ya tiene acceso al portal.</p>
        )}

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={ofrecerPortal && crearPortal && portalPassword.length < 6}
          >
            {editing ? 'Guardar cambios' : 'Crear servicio'}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}
