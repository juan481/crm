'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  CICLO_OPTIONS, ESTADO_OPTIONS, CANAL_OPTIONS, MONEDAS_VALIDAS,
  TIPOS_SERVICIO, tipoDeServicio, DEALER_FORMATO, type TipoServicio,
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
  canalIngreso: string
  contratoInicio: string
  contratoFin: string
  estado: string
  serial: string
  version: string
  puestos: string
  notas: string
  numeroAbonado: string
  dealer: string
  modulos: string[]
}

const EMPTY: FormState = {
  empresaId: '', nombre: '', monto: '', moneda: 'USD', ciclo: 'MENSUAL', diaVencimiento: '10',
  medioCobro: '', canalIngreso: 'CRM',
  contratoInicio: '', contratoFin: '', estado: 'ACTIVO',
  serial: '', version: '', puestos: '', notas: '', numeroAbonado: '', dealer: '', modulos: [],
}

const MEDIO_COBRO_OPTIONS = [
  { value: '', label: 'Automático (según la moneda)' },
  { value: 'MERCADOPAGO', label: 'Mercado Pago' },
  { value: 'WHOP', label: 'Whop' },
  { value: 'MANUAL', label: 'Transferencia / manual (sin link de pago)' },
]

const NOMBRE_PLACEHOLDER: Record<TipoServicio, string> = {
  MONITOREO: 'Ej: Monitoreo 24 Hs',
  SAAS: 'Ej: Licencia SoftGuard SaaS — Municipalidad de Moreno',
  PERPETUA: 'Ej: Licencia SoftGuard perpetua',
  OTRO: 'Ej: Mantenimiento mensual',
}

const isoToDateInput = (v: string | null) => (v ? v.slice(0, 10) : '')

// Contraseña inicial del portal: fácil de dictar por teléfono (sin 0/O/1/l).
function passwordInicial(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// Pedido de Abba (Seba, 27/10): el formulario pedía los mismos campos para
// todo y la mitad no aplicaba. Primero se elige QUÉ se carga y se muestra
// sólo lo que corresponde:
//  - Monitoreo 24/7: lo indispensable es el N° de abonado del Ultra (y de
//    ahí el usuario del portal). Sin modo de licencia, canal, serial,
//    versión ni puestos.
//  - Licencia SaaS: código de Dealer (ABC123) en vez de serial, módulos y
//    aplicaciones contratadas, puestos de operadores como dato secundario,
//    sin monitoreo.
//  - Licencia perpetua: serial, versión y puestos.
//  - Otro: lo genérico.
// El tipo no es una columna: sale de modoLicencia + incluyeMonitoreo
// (tipoDeServicio), así los abonos viejos se abren en el tipo correcto.
export function ServicioForm({ open, onClose, onSaved, servicio, empresaId, empresaNombre }: Props) {
  const editing = !!servicio
  const { user } = useAuthStore()
  // Dar acceso al portal es Admin+ (ver /api/empresas/[id]/portal-acceso).
  const puedeDarPortal = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
  const [form, setForm] = useState<FormState>(EMPTY)
  const [tipo, setTipo] = useState<TipoServicio | ''>('')
  const [moduloInput, setModuloInput] = useState('')
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
    enabled: open && puedeDarPortal && !!form.empresaId && tipo === 'MONITOREO',
    staleTime: 30_000,
  })
  const abonadoNormalizado = form.numeroAbonado.trim().toUpperCase().replace(/[\s-]+/g, '')
  const yaTienePortal = !!abonadoNormalizado && (portalUsers ?? []).some((u) => u.numeroAbonado === abonadoNormalizado)
  const ofrecerPortal = tipo === 'MONITOREO' && puedeDarPortal && !!abonadoNormalizado && portalUsers !== undefined && !yaTienePortal

  // Módulos ya usados en otras licencias — para escribirlos siempre igual.
  const { data: modulosUsados } = useQuery<string[]>({
    queryKey: ['servicios-modulos'],
    queryFn: async () => {
      const r = await fetch('/api/servicios-recurrentes/modulos')
      if (!r.ok) return []
      return ((await r.json()).data ?? []) as string[]
    },
    enabled: open && tipo === 'SAAS',
    staleTime: 60_000,
  })
  const sugerencias = (modulosUsados ?? []).filter((m) => !form.modulos.some((x) => x.toLowerCase() === m.toLowerCase())).slice(0, 10)

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
    setModuloInput('')
    if (servicio) {
      setForm({
        empresaId: servicio.empresaId,
        nombre: servicio.nombre,
        monto: String(servicio.monto ?? ''),
        moneda: servicio.moneda || 'USD',
        ciclo: servicio.ciclo,
        diaVencimiento: String(servicio.diaVencimiento ?? 10),
        medioCobro: servicio.medioCobro ?? '',
        canalIngreso: servicio.canalIngreso || 'CRM',
        contratoInicio: isoToDateInput(servicio.contratoInicio),
        contratoFin: isoToDateInput(servicio.contratoFin),
        estado: servicio.estado,
        serial: servicio.serial ?? '',
        version: servicio.version ?? '',
        puestos: servicio.puestos != null ? String(servicio.puestos) : '',
        notas: servicio.notas ?? '',
        numeroAbonado: servicio.numeroAbonado ?? '',
        dealer: servicio.dealer ?? '',
        modulos: servicio.modulos ?? [],
      })
      setTipo(tipoDeServicio(servicio))
      setShowLicencia(!!(servicio.serial || servicio.version || servicio.puestos != null))
    } else {
      setForm({ ...EMPTY, empresaId: empresaId ?? '' })
      setTipo('')
      setShowLicencia(false)
    }
  }, [open, servicio, empresaId])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }))

  const agregarModulo = (raw: string) => {
    const nombres = raw.split(',').map((s) => s.trim()).filter(Boolean)
    if (nombres.length === 0) return
    setForm((f) => {
      const next = [...f.modulos]
      for (const n of nombres) if (!next.some((m) => m.toLowerCase() === n.toLowerCase())) next.push(n.slice(0, 60))
      return { ...f, modulos: next }
    })
    setModuloInput('')
  }

  const handleSave = async () => {
    if (!form.empresaId) { toast.error('Elegí la empresa'); return }
    if (!tipo) { toast.error('Elegí qué estás cargando (monitoreo, licencia SaaS…)'); return }
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
    const dealer = form.dealer.trim().toUpperCase().replace(/[\s-]+/g, '')
    if (tipo === 'MONITOREO' && !abonadoNormalizado) { toast.error('Cargá el N° de abonado del Ultra — es lo que identifica al cliente en monitoreo'); return }
    if (tipo === 'SAAS' && !DEALER_FORMATO.test(dealer)) { toast.error('El código de Dealer tiene que ser 3 letras y 3 números (ej. ABC123)'); return }
    // Lo que se escribió en el campo de módulos sin apretar Enter también va.
    const modulos = moduloInput.trim()
      ? [...form.modulos, ...moduloInput.split(',').map((s) => s.trim()).filter(Boolean)]
      : form.modulos
    if (tipo === 'SAAS' && modulos.length === 0) { toast.error('Agregá al menos un módulo o aplicación contratada'); return }

    setSaving(true)
    try {
      const comun = {
        empresaId: form.empresaId,
        nombre: form.nombre.trim(),
        monto,
        moneda: form.moneda,
        ciclo: form.ciclo,
        diaVencimiento: Number(form.diaVencimiento) || 10,
        medioCobro: form.medioCobro || null,
        contratoInicio: form.contratoInicio || null,
        contratoFin: form.contratoFin || null,
        estado: form.estado,
        notas: form.notas.trim() || null,
      }
      const puestos = form.puestos === '' ? null : Number(form.puestos)
      // Lo que no aplica a un tipo se manda vacío — si un abono cambia de
      // tipo, no le quedan datos del otro colgados.
      const porTipo: Record<TipoServicio, Record<string, unknown>> = {
        MONITOREO: { modoLicencia: 'NINGUNA', incluyeMonitoreo: true, numeroAbonado: abonadoNormalizado, dealer: null, modulos: [] },
        SAAS: {
          modoLicencia: 'SAAS', incluyeMonitoreo: false, dealer, modulos, puestos,
          canalIngreso: form.canalIngreso, numeroAbonado: null, serial: null,
        },
        PERPETUA: {
          modoLicencia: 'PERPETUA', incluyeMonitoreo: false, serial: form.serial.trim() || null,
          version: form.version.trim() || null, puestos, canalIngreso: form.canalIngreso,
          numeroAbonado: null, dealer: null, modulos: [],
        },
        OTRO: {
          modoLicencia: 'NINGUNA', incluyeMonitoreo: false, canalIngreso: form.canalIngreso,
          serial: form.serial.trim() || null, version: form.version.trim() || null, puestos,
          dealer: null, modulos: [],
        },
      }
      const res = await fetch(
        editing ? `/api/servicios-recurrentes/${servicio!.id}` : '/api/servicios-recurrentes',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...comun, ...porTipo[tipo] }),
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

        {/* ── ¿Qué se carga? ── */}
        <div>
          <label className="text-sm font-medium text-[var(--color-text-muted)] block mb-1.5">¿Qué estás cargando?</label>
          <div className="grid grid-cols-2 gap-2">
            {TIPOS_SERVICIO.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                className="text-left rounded-xl px-3 py-2.5 border transition-colors"
                style={tipo === t.value
                  ? { borderColor: 'var(--color-primary)', background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }
                  : { borderColor: 'var(--color-border)' }}
              >
                <p className="text-sm font-semibold" style={{ color: tipo === t.value ? 'var(--color-primary)' : 'var(--color-text)' }}>{t.label}</p>
                <p className="text-[11px] text-[var(--color-text-subtle)] leading-snug">{t.hint}</p>
              </button>
            ))}
          </div>
        </div>

        {tipo && (
          <>
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
              placeholder={NOMBRE_PLACEHOLDER[tipo]}
              value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
            />

            {/* ── Monitoreo: el N° de abonado del Ultra es lo indispensable
                (migración de CRA + usuario del portal). ── */}
            {tipo === 'MONITOREO' && (
              <Input
                label="N° de abonado (Ultra)"
                placeholder="Ej: ABB3434"
                value={form.numeroAbonado}
                onChange={e => set('numeroAbonado', e.target.value.toUpperCase().replace(/[\s-]+/g, ''))}
                hint="El código del abonado en el Ultra: letras del dealer + número (ej. ABB3434)."
              />
            )}

            {/* ── Licencia SaaS: Dealer en vez de serial, y módulos. ── */}
            {tipo === 'SAAS' && (
              <>
                <Input
                  label="Código de Dealer"
                  placeholder="Ej: ABC123"
                  value={form.dealer}
                  maxLength={7}
                  onChange={e => set('dealer', e.target.value.toUpperCase().replace(/[\s-]+/g, ''))}
                  hint="3 letras y 3 números. Reemplaza al número de serie."
                />
                <div>
                  <label className="text-sm font-medium text-[var(--color-text-muted)] block mb-1.5">Módulos y aplicaciones contratadas</label>
                  <div className="rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-2 flex flex-wrap gap-1.5 items-center">
                    {form.modulos.map((m) => (
                      <span key={m} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text)' }}>
                        {m}
                        <button type="button" onClick={() => set('modulos', form.modulos.filter((x) => x !== m))} className="text-[var(--color-text-subtle)] hover:text-red-400"><X size={11} /></button>
                      </span>
                    ))}
                    <input
                      value={moduloInput}
                      onChange={e => setModuloInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); agregarModulo(moduloInput) }
                        if (e.key === 'Backspace' && !moduloInput && form.modulos.length) set('modulos', form.modulos.slice(0, -1))
                      }}
                      onBlur={() => agregarModulo(moduloInput)}
                      placeholder={form.modulos.length ? 'Agregar otro…' : 'Escribí y Enter (ej: Monitoreo, App de pánico, VigiControl)'}
                      className="flex-1 min-w-[160px] bg-transparent text-sm outline-none px-1 text-[var(--color-text)]"
                    />
                  </div>
                  {sugerencias.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 text-[11px] text-[var(--color-text-subtle)] items-center">
                      Ya usados:
                      {sugerencias.map((s) => (
                        <button key={s} type="button" onClick={() => agregarModulo(s)}
                          className="px-1.5 py-0.5 rounded border border-[var(--color-border)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]">
                          + {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

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

            {/* ── Contrato ── */}
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Inicio de contrato (opcional)" type="date" value={form.contratoInicio} onChange={e => set('contratoInicio', e.target.value)} />
              <Input label="Fin de contrato (opcional)" type="date" value={form.contratoFin} onChange={e => set('contratoFin', e.target.value)} hint="Vacío = renovación automática" />
            </div>

            {/* ── Clasificación / datos de licencia según el tipo ── */}
            {tipo !== 'MONITOREO' && (
              <div className="grid sm:grid-cols-2 gap-3">
                <Select label="Canal de ingreso" value={form.canalIngreso} onChange={e => set('canalIngreso', e.target.value)}
                  options={CANAL_OPTIONS.map(c => ({ value: c, label: c }))} />
                {tipo === 'SAAS' && (
                  <Input label="Puestos de operadores (opcional)" type="number" min="0" value={form.puestos} onChange={e => set('puestos', e.target.value)} />
                )}
              </div>
            )}
            {tipo === 'PERPETUA' && (
              <div className="grid sm:grid-cols-3 gap-3">
                <Input label="Serial" value={form.serial} onChange={e => set('serial', e.target.value)} />
                <Input label="Versión" value={form.version} onChange={e => set('version', e.target.value)} />
                <Input label="Puestos" type="number" min="0" value={form.puestos} onChange={e => set('puestos', e.target.value)} />
              </div>
            )}
            {tipo === 'OTRO' && (
              <>
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
              </>
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
            {tipo === 'MONITOREO' && puedeDarPortal && yaTienePortal && (
              <p className="text-xs text-[var(--color-text-subtle)]">El abonado {abonadoNormalizado} ya tiene acceso al portal.</p>
            )}
          </>
        )}

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={!tipo || (ofrecerPortal && crearPortal && portalPassword.length < 6)}
          >
            {editing ? 'Guardar cambios' : 'Crear servicio'}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}
