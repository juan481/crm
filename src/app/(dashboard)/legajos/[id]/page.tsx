'use client'

import { useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Pencil, Trash2, Calendar, MapPin, ShieldCheck, FileText,
  Upload, Download, GraduationCap, Clock, Plus, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { LegajoForm } from '@/components/legajos/legajo-form'
import { daysUntilDateOnly, fmtDateOnly as fmtDate } from '@/lib/timezone'
import { useAuthStore } from '@/store/auth-store'
import toast from 'react-hot-toast'

interface Documento {
  id: string; name: string; originalName: string; url: string; createdAt: string
}
interface Curso { id: string; nombre: string; fecha: string | null }
interface Turno {
  id: string; fecha: string; horaEntrada: string | null; horaSalida: string | null
  lugarTrabajo: string | null; observaciones: string | null
}
interface VigiladorDetail {
  id: string; nombre: string; apellido: string; dni: string
  fechaIngreso: string | null; carnetVencimiento: string | null
  art: string | null; lugarTrabajo: string | null; activo: boolean; notas: string | null
  documentos: Documento[]; cursos: Curso[]; turnos: Turno[]
}

// horaEntrada/horaSalida SÍ son instantes reales (a diferencia de los
// campos @db.Date que usan fmtDate, importado de timezone.ts) — toLocaleTimeString
// con timezone local es lo correcto acá, no tiene el bug de día corrido.
function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}
// daysUntilDateOnly(fechaIngreso) da negativo (ingreso en el pasado) —
// mismo criterio día-calendario que el resto de la página, en vez de
// restar instantes completos (que arrastra el mismo corrimiento de ~3hs
// cerca del aniversario exacto).
function antiguedad(fechaIngreso: string | null) {
  if (!fechaIngreso) return '—'
  const dias = -daysUntilDateOnly(fechaIngreso)
  const years = dias / 365.25
  if (years < 1) return `${Math.max(0, Math.round(dias / 30.4))} meses`
  return `${years.toFixed(1).replace('.0', '')} años`
}

export default function LegajoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const fileRef = useRef<HTMLInputElement>(null)

  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showCursoForm, setShowCursoForm] = useState(false)
  const [showTurnoForm, setShowTurnoForm] = useState(false)

  const canDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'

  const { data, isLoading } = useQuery<VigiladorDetail>({
    queryKey: ['legajo', id],
    queryFn: async () => {
      const res = await fetch(`/api/legajos/${id}`)
      if (!res.ok) throw new Error('No encontrado')
      return res.json().then(j => j.data)
    },
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['legajo', id] })

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/legajos/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al eliminar'); return }
      toast.success('Legajo eliminado')
      router.push('/legajos')
    } catch { toast.error('Error de conexión') } finally { setDeleting(false) }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('legajoId', id)
      const res = await fetch('/api/documentos/upload', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al subir archivo'); return }
      toast.success('Documento subido')
      invalidate()
    } catch { toast.error('Error de conexión') } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDeleteDoc = async (docId: string) => {
    try {
      const res = await fetch(`/api/documentos/${docId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al eliminar'); return }
      invalidate()
    } catch { toast.error('Error de conexión') }
  }

  const handleAddCurso = async (nombre: string, fecha: string) => {
    const res = await fetch(`/api/legajos/${id}/cursos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, fecha: fecha || null }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Error'); return }
    toast.success('Curso agregado')
    setShowCursoForm(false)
    invalidate()
  }

  const handleDeleteCurso = async (cursoId: string) => {
    const res = await fetch(`/api/legajos/${id}/cursos/${cursoId}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Error al eliminar'); return }
    invalidate()
  }

  const handleAddTurno = async (fecha: string, horaEntrada: string, horaSalida: string, lugarTrabajo: string, observaciones: string) => {
    // fecha "YYYY-MM-DD" y horas "HH:MM" sueltas — el server las combina con
    // argentinaTimeToInstant (ver /api/legajos/[id]/turnos/route.ts); no se
    // combinan acá para no repetir esa conversión en dos lugares.
    const res = await fetch(`/api/legajos/${id}/turnos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fecha,
        horaEntrada: horaEntrada || null,
        horaSalida: horaSalida || null,
        lugarTrabajo: lugarTrabajo || null,
        observaciones: observaciones || null,
      }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Error'); return }
    toast.success('Turno agregado')
    setShowTurnoForm(false)
    invalidate()
  }

  const handleDeleteTurno = async (turnoId: string) => {
    const res = await fetch(`/api/legajos/${id}/turnos/${turnoId}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Error al eliminar'); return }
    invalidate()
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    )
  }
  if (!data) return null

  // Comparación por día-calendario, no por instante — ver daysUntilDateOnly
  // (mismo fix que en /legajos/page.tsx). Un solo cálculo, no uno por
  // chequeo.
  const diasCarnet = data.carnetVencimiento ? daysUntilDateOnly(data.carnetVencimiento) : null
  const vencido = diasCarnet !== null && diasCarnet < 0
  const porVencer = diasCarnet !== null && diasCarnet >= 0 && diasCarnet <= 30

  return (
    <div className="space-y-5">
      <button onClick={() => router.push('/legajos')} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <ArrowLeft size={16} /> Legajos
      </button>

      <div className="surface rounded-2xl p-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{data.nombre} {data.apellido}</h1>
            {!data.activo && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-subtle)' }}>Inactivo</span>
            )}
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>DNI {data.dni}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setEditing(true)} className="p-2 rounded-lg hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-muted)' }} title="Editar">
            <Pencil size={16} />
          </button>
          {canDelete && (
            <button onClick={() => setConfirmDelete(true)} className="p-2 rounded-lg hover:bg-red-500/10 hover:text-red-400" style={{ color: 'var(--color-text-muted)' }} title="Eliminar">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="surface rounded-xl p-3">
          <p className="flex items-center gap-1 text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}><Calendar size={12} /> Antigüedad</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{antiguedad(data.fechaIngreso)}</p>
        </div>
        <div className="surface rounded-xl p-3">
          <p className="flex items-center gap-1 text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}><ShieldCheck size={12} /> Carnet vence</p>
          <p className="text-sm font-semibold" style={{ color: vencido ? '#ef4444' : porVencer ? '#f59e0b' : 'var(--color-text)' }}>{fmtDate(data.carnetVencimiento)}</p>
        </div>
        <div className="surface rounded-xl p-3">
          <p className="flex items-center gap-1 text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}><ShieldCheck size={12} /> ART</p>
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>{data.art ?? '—'}</p>
        </div>
        <div className="surface rounded-xl p-3">
          <p className="flex items-center gap-1 text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}><MapPin size={12} /> Lugar de trabajo</p>
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>{data.lugarTrabajo ?? '—'}</p>
        </div>
      </div>

      {data.notas && (
        <div className="surface rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-text-subtle)' }}>Notas</p>
          <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-muted)' }}>{data.notas}</p>
        </div>
      )}

      {/* Documentos */}
      <div className="surface rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            <FileText size={14} /> Documentos (carnet, DNI, contrato)
          </p>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleUpload} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            <Upload size={13} /> {uploading ? 'Subiendo...' : 'Subir documento'}
          </button>
        </div>
        {data.documentos.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-muted)' }}>Sin documentos cargados.</p>
        ) : (
          <div className="space-y-1.5">
            {data.documentos.map(doc => (
              <div key={doc.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--color-surface-raised)' }}>
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:underline truncate" style={{ color: 'var(--color-text)' }}>
                  <Download size={13} /> {doc.name}
                </a>
                <button onClick={() => handleDeleteDoc(doc.id)} className="text-[var(--color-text-subtle)] hover:text-red-400 shrink-0"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cursos */}
      <div className="surface rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            <GraduationCap size={14} /> Cursos realizados
          </p>
          <button onClick={() => setShowCursoForm(true)} className="flex items-center gap-1 text-xs px-2 py-1" style={{ color: 'var(--color-primary)' }}>
            <Plus size={13} /> Agregar
          </button>
        </div>
        {data.cursos.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-muted)' }}>Sin cursos cargados.</p>
        ) : (
          <div className="space-y-1.5">
            {data.cursos.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--color-surface-raised)' }}>
                <span className="text-sm" style={{ color: 'var(--color-text)' }}>{c.nombre}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{fmtDate(c.fecha)}</span>
                  <button onClick={() => handleDeleteCurso(c.id)} className="text-[var(--color-text-subtle)] hover:text-red-400"><X size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Turnos */}
      <div className="surface rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            <Clock size={14} /> Turnos / asistencia
          </p>
          <button onClick={() => setShowTurnoForm(true)} className="flex items-center gap-1 text-xs px-2 py-1" style={{ color: 'var(--color-primary)' }}>
            <Plus size={13} /> Agregar
          </button>
        </div>
        {data.turnos.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-muted)' }}>Sin turnos cargados.</p>
        ) : (
          <div className="space-y-1.5">
            {data.turnos.map(t => (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--color-surface-raised)' }}>
                <div className="text-sm" style={{ color: 'var(--color-text)' }}>
                  {fmtDate(t.fecha)} <span style={{ color: 'var(--color-text-muted)' }}>· {fmtTime(t.horaEntrada)} a {fmtTime(t.horaSalida)}</span>
                  {t.lugarTrabajo && <span className="text-xs ml-2" style={{ color: 'var(--color-text-subtle)' }}>({t.lugarTrabajo})</span>}
                </div>
                <button onClick={() => handleDeleteTurno(t.id)} className="text-[var(--color-text-subtle)] hover:text-red-400 shrink-0"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Editar legajo" size="md">
        <LegajoForm vigilador={data} onSuccess={() => { setEditing(false); invalidate() }} />
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Eliminar legajo" size="sm">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Esto borra el legajo y todos sus documentos, cursos y turnos cargados. No se puede deshacer.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>Eliminar</Button>
        </div>
      </Modal>

      <Modal open={showCursoForm} onClose={() => setShowCursoForm(false)} title="Agregar curso" size="sm">
        <CursoForm onSubmit={handleAddCurso} />
      </Modal>

      <Modal open={showTurnoForm} onClose={() => setShowTurnoForm(false)} title="Agregar turno" size="sm">
        <TurnoForm onSubmit={handleAddTurno} />
      </Modal>
    </div>
  )
}

function CursoForm({ onSubmit }: { onSubmit: (nombre: string, fecha: string) => void }) {
  const [nombre, setNombre] = useState('')
  const [fecha, setFecha] = useState('')
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (nombre.trim()) onSubmit(nombre.trim(), fecha) }} className="space-y-3">
      <Input label="Curso" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Curso de vigilador privado" autoFocus />
      <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
      <div className="flex justify-end"><Button type="submit">Agregar</Button></div>
    </form>
  )
}

function TurnoForm({ onSubmit }: { onSubmit: (fecha: string, horaEntrada: string, horaSalida: string, lugarTrabajo: string, observaciones: string) => void }) {
  const [fecha, setFecha] = useState('')
  const [horaEntrada, setHoraEntrada] = useState('')
  const [horaSalida, setHoraSalida] = useState('')
  const [lugarTrabajo, setLugarTrabajo] = useState('')
  const [observaciones, setObservaciones] = useState('')
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (fecha) onSubmit(fecha, horaEntrada, horaSalida, lugarTrabajo, observaciones) }} className="space-y-3">
      <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Entrada" type="time" value={horaEntrada} onChange={e => setHoraEntrada(e.target.value)} />
        <Input label="Salida" type="time" value={horaSalida} onChange={e => setHoraSalida(e.target.value)} />
      </div>
      <Input label="Lugar de trabajo" value={lugarTrabajo} onChange={e => setLugarTrabajo(e.target.value)} placeholder="Sitio / obra" />
      <Input label="Observaciones" value={observaciones} onChange={e => setObservaciones(e.target.value)} />
      <div className="flex justify-end"><Button type="submit">Agregar</Button></div>
    </form>
  )
}
