'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Plus, Pencil, Trash2, Clock, Filter, Star, Briefcase, Home, Sun, MapPin, Map as MapIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { MODALIDADES_FICHAJE, ETIQUETAS_TURNO } from '@/lib/asistencia-turnos'
import { invalidateFichaje } from '@/lib/asistencia-query-keys'
import { argentinaDayKey } from '@/lib/timezone'
import type { MapPoint } from '@/components/rrhh/tecnicos-map'
import toast from 'react-hot-toast'

// Leaflet toca `window` directo — ssr:false + import dinámico, mismo
// criterio que ya usa el resto del proyecto para librerías cliente-only
// (ej. CampaignComposer en comunicaciones/page.tsx). Sólo se carga si Sergio
// abre el mapa (ver toggle más abajo), no en cada visita a esta pantalla.
const TecnicosMap = dynamic(
  () => import('@/components/rrhh/tecnicos-map').then((m) => m.TecnicosMap),
  { ssr: false, loading: () => <div className="h-[280px] flex items-center justify-center text-sm text-[var(--color-text-muted)]">Cargando mapa…</div> }
)

interface Turno {
  id: string
  userId: string
  fecha: string
  horaEntrada: string | null
  horaSalida: string | null
  modalidad: string
  etiqueta: string
  esPrincipal: boolean
  observaciones: string | null
  latEntrada: number | null
  lngEntrada: number | null
  latSalida: number | null
  lngSalida: number | null
  user: { id: string; name: string; role: string; avatarUrl: string | null }
}

interface UsuarioOpt { id: string; name: string; role: string; status: string }

function mesActual() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function toDateInput(iso: string | null): string { return iso ? iso.slice(0, 10) : '' }
function toTimeInput(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function horasDe(turno: Turno): string {
  if (!turno.horaEntrada || !turno.horaSalida) return '—'
  const ms = new Date(turno.horaSalida).getTime() - new Date(turno.horaEntrada).getTime()
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`
}

const ETIQUETA_STYLE: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  'Regular':                 { bg: 'rgba(99,102,241,0.1)',  color: 'var(--color-primary)', icon: <Briefcase size={11} /> },
  'Extra/Adicional':         { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b',               icon: <Star size={11} /> },
  'Fin de Semana/Feriado':   { bg: 'rgba(16,185,129,0.1)',   color: '#10b981',               icon: <Sun size={11} /> },
}

const EMPTY_FORM = {
  userId: '', entradaFecha: '', entradaHora: '', salidaFecha: '', salidaHora: '',
  modalidad: MODALIDADES_FICHAJE[0], etiqueta: ETIQUETAS_TURNO[0], observaciones: '',
}

export default function TurnosAsistenciaPage() {
  const router = useRouter()
  const qc = useQueryClient()

  const [mes, setMes] = useState(mesActual())
  const [empleadoFiltro, setEmpleadoFiltro] = useState('')
  const [etiquetaFiltro, setEtiquetaFiltro] = useState('')
  const [modalidadFiltro, setModalidadFiltro] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Turno | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [showMap, setShowMap] = useState(false)

  const { data: usuariosData } = useQuery({
    queryKey: ['usuarios-internos'],
    queryFn: async () => {
      const r = await fetch('/api/usuarios')
      if (!r.ok) return { data: [] }
      return r.json()
    },
    staleTime: 5 * 60 * 1000,
  })
  const usuarios: UsuarioOpt[] = (usuariosData?.data ?? []).filter((u: UsuarioOpt) => u.status === 'ACTIVE')

  const { data: turnosData, isLoading, isError } = useQuery({
    queryKey: ['turnos-asistencia', mes, empleadoFiltro, etiquetaFiltro, modalidadFiltro],
    queryFn: async () => {
      const params = new URLSearchParams({ mes })
      if (empleadoFiltro) params.set('userId', empleadoFiltro)
      if (etiquetaFiltro) params.set('etiqueta', etiquetaFiltro)
      if (modalidadFiltro) params.set('modalidad', modalidadFiltro)
      const r = await fetch(`/api/asistencia/turnos?${params}`)
      if (!r.ok) return []
      return ((await r.json()).data ?? []) as Turno[]
    },
  })
  const turnos = turnosData ?? []

  const totalMs = turnos.reduce((s, t) => {
    if (!t.horaEntrada || !t.horaSalida) return s
    return s + (new Date(t.horaSalida).getTime() - new Date(t.horaEntrada).getTime())
  }, 0)
  const totalHorasLabel = `${Math.floor(totalMs / 3_600_000)}h ${Math.floor((totalMs % 3_600_000) / 60_000)}m`

  // Puntos del mapa — respeta el mismo filtro que ya aplica a la tabla
  // (mes/empleado/etiqueta/modalidad), igual que "Total horas" de arriba.
  // useMemo: turnos cambia de referencia en cada refetch aunque el
  // contenido sea igual — sin esto, TecnicosMap recibía un array `points`
  // nuevo en cada render y destruía/recreaba el mapa de Leaflet sin razón.
  const mapPoints = useMemo<MapPoint[]>(() => turnos.flatMap((t) => {
    const pts: MapPoint[] = []
    if (t.latEntrada != null && t.lngEntrada != null) {
      pts.push({ lat: t.latEntrada, lng: t.lngEntrada, kind: 'entrada', label: `${t.user.name} — Entrada ${toTimeInput(t.horaEntrada)}` })
    }
    if (t.latSalida != null && t.lngSalida != null) {
      pts.push({ lat: t.latSalida, lng: t.lngSalida, kind: 'salida', label: `${t.user.name} — Salida ${toTimeInput(t.horaSalida)}` })
    }
    return pts
  }), [turnos])

  const openCreate = () => {
    setEditing(null)
    // Bug real encontrado en auditoría: new Date().toISOString() usa el día
    // en UTC, no en Argentina — entre las 21:00 y 23:59 hora Argentina esto
    // precargaba la fecha de MAÑANA en vez de la de hoy, justo el horario
    // más probable para cargar un turno nocturno olvidado.
    setForm({ ...EMPTY_FORM, entradaFecha: argentinaDayKey() })
    setModalOpen(true)
  }
  const openEdit = (t: Turno) => {
    setEditing(t)
    setForm({
      userId: t.userId,
      entradaFecha: toDateInput(t.fecha), entradaHora: toTimeInput(t.horaEntrada),
      salidaFecha: t.horaSalida ? toDateInput(t.horaSalida) : '', salidaHora: toTimeInput(t.horaSalida),
      modalidad: t.modalidad, etiqueta: t.etiqueta, observaciones: t.observaciones ?? '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!editing && !form.userId) { toast.error('Elegí un empleado'); return }
    if (!form.entradaFecha) { toast.error('La fecha de entrada es requerida'); return }
    // Bugs reales encontrados en auditoría: sin esto, se podía "crear" un
    // bloque con fecha de entrada pero sin hora (columna Entrada quedaba
    // "—" sin ningún aviso), o cargar una fecha de salida sin su hora (se
    // descartaba en silencio, el bloque quedaba abierto como si no se
    // hubiera tocado ese campo).
    if (!form.entradaHora) { toast.error('La hora de entrada es requerida'); return }
    if (form.salidaFecha && !form.salidaHora) { toast.error('Falta la hora de salida'); return }
    if (form.salidaHora && !form.salidaFecha) { toast.error('Falta la fecha de salida'); return }
    setSaving(true)
    try {
      const body = editing
        ? {
            entradaHora: form.entradaHora || null,
            salidaFecha: form.salidaFecha || null, salidaHora: form.salidaHora || null,
            modalidad: form.modalidad, etiqueta: form.etiqueta, observaciones: form.observaciones || null,
          }
        : {
            userId: form.userId, entradaFecha: form.entradaFecha, entradaHora: form.entradaHora || null,
            salidaFecha: form.salidaFecha || null, salidaHora: form.salidaHora || null,
            modalidad: form.modalidad, etiqueta: form.etiqueta, observaciones: form.observaciones || null,
          }
      const res = await fetch(editing ? `/api/asistencia/turnos/${editing.id}` : '/api/asistencia/turnos', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success(editing ? 'Bloque actualizado' : 'Bloque creado')
      invalidateFichaje(qc)
      setModalOpen(false)
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  const handleDelete = async (t: Turno) => {
    if (!confirm(`¿Eliminar este bloque de ${t.user.name}?`)) return
    const res = await fetch(`/api/asistencia/turnos/${t.id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(json.error ?? 'Error'); return }
    toast.success('Bloque eliminado')
    invalidateFichaje(qc)
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap justify-between">
        <button onClick={() => router.push('/rrhh')}
          className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
          style={{ color: 'var(--color-text-muted)' }}>
          <ArrowLeft size={15} /> RRHH
        </button>
        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center"><Clock size={16} className="text-white" /></div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Turnos y bloques</h1>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Fichajes reales, regulares y extras</p>
            </div>
          </div>
        </div>
        <Button onClick={openCreate} leftIcon={<Plus size={14} />}>Nuevo bloque</Button>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--color-text-muted)' }}>
          <Filter size={13} /><span className="text-xs font-semibold uppercase tracking-widest">Filtros</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Mes</label>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
              style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text)' }} />
          </div>
          <Select label="Empleado" value={empleadoFiltro} onChange={e => setEmpleadoFiltro(e.target.value)}
            options={[{ value: '', label: 'Todos' }, ...usuarios.map(u => ({ value: u.id, label: u.name }))]} />
          <Select label="Etiqueta" value={etiquetaFiltro} onChange={e => setEtiquetaFiltro(e.target.value)}
            options={[{ value: '', label: 'Todas' }, ...ETIQUETAS_TURNO.map(e => ({ value: e, label: e }))]} />
          <Select label="Modalidad" value={modalidadFiltro} onChange={e => setModalidadFiltro(e.target.value)}
            options={[{ value: '', label: 'Todas' }, ...MODALIDADES_FICHAJE.map(m => ({ value: m, label: m }))]} />
        </div>
      </div>

      {/* Total */}
      {!isLoading && turnos.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: 'var(--color-primary-light)' }}>
          <Clock size={16} style={{ color: 'var(--color-primary)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text)' }}>
            <span className="font-bold">{totalHorasLabel}</span> totales en {turnos.length} bloque{turnos.length !== 1 ? 's' : ''} (según filtro actual)
          </p>
        </div>
      )}

      {/* Mapa de fichajes — mismo filtro que la tabla de abajo. Colapsado por
          defecto: no tiene sentido pagar la carga de Leaflet/OSM para
          alguien que sólo quiere editar un bloque. */}
      {!isLoading && turnos.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <button
            onClick={() => setShowMap((v) => !v)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--color-surface-raised)]"
            style={{ color: 'var(--color-text)' }}
          >
            <span className="flex items-center gap-2">
              <MapIcon size={15} style={{ color: 'var(--color-text-muted)' }} />
              Mapa de fichajes
              {mapPoints.length > 0 && (
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                  {mapPoints.length}
                </span>
              )}
            </span>
            <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{showMap ? 'Ocultar' : 'Mostrar'}</span>
          </button>
          {showMap && (
            mapPoints.length === 0 ? (
              <p className="px-4 pb-5 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
                Ninguno de los bloques de este filtro tiene ubicación registrada.
              </p>
            ) : (
              <div className="px-4 pb-4">
                <div className="flex items-center gap-4 mb-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#10b981' }} />Entrada</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#6366f1' }} />Salida</span>
                </div>
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                  <TecnicosMap points={mapPoints} />
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Tabla */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : isError ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Error al cargar los datos. Intentá de nuevo.</p>
      ) : turnos.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <Clock size={28} className="mx-auto mb-2" style={{ color: 'var(--color-text-subtle)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin bloques para este filtro.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
                {['Empleado', 'Fecha', 'Modalidad', 'Etiqueta', 'Entrada', 'Salida', 'Horas', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {turnos.map(t => {
                const est = ETIQUETA_STYLE[t.etiqueta] ?? ETIQUETA_STYLE['Regular']
                return (
                  <tr key={t.id} className="hover:bg-[var(--color-surface-raised)] transition-colors" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: 'var(--color-text)' }}>
                      {t.user.name}{t.esPrincipal && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-subtle)' }}>Principal</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(t.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                      <span className="flex items-center gap-1">{t.modalidad === 'Presencial' ? <Home size={11} /> : <Briefcase size={11} />}{t.modalidad}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(t)} className="text-xs px-2 py-1 rounded-full flex items-center gap-1 whitespace-nowrap" style={{ background: est.bg, color: est.color }}>
                        {est.icon}{t.etiqueta}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                      <span className="flex items-center gap-1">
                        {toTimeInput(t.horaEntrada) || '—'}
                        {t.latEntrada != null && t.lngEntrada != null && (
                          <a href={`https://www.google.com/maps?q=${t.latEntrada},${t.lngEntrada}`} target="_blank" rel="noopener noreferrer"
                            title="Ver ubicación de entrada" className="hover:text-[var(--color-primary)] transition-colors">
                            <MapPin size={11} />
                          </a>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                      <span className="flex items-center gap-1">
                        {toTimeInput(t.horaSalida) || '—'}
                        {t.latSalida != null && t.lngSalida != null && (
                          <a href={`https://www.google.com/maps?q=${t.latSalida},${t.lngSalida}`} target="_blank" rel="noopener noreferrer"
                            title="Ver ubicación de salida" className="hover:text-[var(--color-primary)] transition-colors">
                            <MapPin size={11} />
                          </a>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium" style={{ color: 'var(--color-text)' }}>{horasDe(t)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] transition-colors" style={{ color: 'var(--color-text-muted)' }}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(t)} className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors" style={{ color: 'var(--color-text-muted)' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear/editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar bloque' : 'Nuevo bloque'} size="md">
        <div className="space-y-4">
          {!editing && (
            <Select label="Empleado" value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
              options={[{ value: '', label: 'Seleccionar...' }, ...usuarios.map(u => ({ value: u.id, label: u.name }))]} />
          )}
          <div className="grid grid-cols-2 gap-3">
            {/* Bug real encontrado en auditoría: este campo se mostraba
                editable en modo edición, pero el PATCH del backend no
                soporta mover un bloque a otro día — el cambio se
                guardaba en el form y se descartaba en silencio al
                grabar, sin ningún aviso. Ahora queda deshabilitado y
                explícito en vez de prometer algo que no hace. */}
            <Input label="Fecha de entrada" type="date" value={form.entradaFecha} disabled={!!editing}
              onChange={e => setForm(f => ({ ...f, entradaFecha: e.target.value }))}
              hint={editing ? 'Para cambiar el día, eliminá este bloque y creá uno nuevo' : undefined} />
            <Input label="Hora de entrada" type="time" value={form.entradaHora} onChange={e => setForm(f => ({ ...f, entradaHora: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha de salida" type="date" value={form.salidaFecha} onChange={e => setForm(f => ({ ...f, salidaFecha: e.target.value }))}
              hint="Vacío = deja el bloque abierto" />
            <Input label="Hora de salida" type="time" value={form.salidaHora} onChange={e => setForm(f => ({ ...f, salidaHora: e.target.value }))} />
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
            Si la salida es al día siguiente (turno que cruza medianoche), poné una fecha de salida distinta a la de entrada — no hace falta que sean el mismo día.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Modalidad" value={form.modalidad} onChange={e => setForm(f => ({ ...f, modalidad: e.target.value }))}
              options={MODALIDADES_FICHAJE.map(m => ({ value: m, label: m }))} />
            <Select label="Etiqueta" value={form.etiqueta} onChange={e => setForm(f => ({ ...f, etiqueta: e.target.value }))}
              options={ETIQUETAS_TURNO.map(e => ({ value: e, label: e }))} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Observaciones</label>
            <textarea rows={2} value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
              placeholder="Notas adicionales..."
              className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 transition-all"
              style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? 'Guardar' : 'Crear bloque'}</Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  )
}
