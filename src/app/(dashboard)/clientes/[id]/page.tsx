'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Building2, MapPin, Globe, UserCheck,
  TrendingUp, FileText, LifeBuoy, ClipboardList, Users,
  DollarSign, Target, CheckSquare, Square, Clock, Mail, Plus, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EmpresaNotas } from '@/components/directorio/empresa-notas'
import { EmpresaCotizaciones } from '@/components/directorio/empresa-cotizaciones'
import { formatCurrency, formatDate, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import type { Empresa, Deal, DealStage, Ticket, Task, TaskPriority } from '@/types'
import toast from 'react-hot-toast'

type Tab = 'resumen' | 'actividad' | 'deals' | 'cotizaciones' | 'tickets' | 'tareas' | 'contactos'

const STAGE_LABELS: Record<DealStage, string> = {
  LEAD: 'Lead', CONTACTADO: 'Contactado', PROPUESTA: 'Propuesta',
  NEGOCIACION: 'Negociación', GANADO: 'Ganado', PERDIDO: 'Perdido',
}

const PRIORITY_OPTIONS = [
  { value: 'BAJA',    label: 'Baja' },
  { value: 'MEDIA',   label: 'Media' },
  { value: 'ALTA',    label: 'Alta' },
  { value: 'URGENTE', label: 'Urgente' },
]

const EMPTY_TASK = { title: '', priority: 'MEDIA' as TaskPriority, dueDate: '', assignedToId: '' }

export default function ClienteDetailPage() {
  const { id }        = useParams<{ id: string }>()
  const router        = useRouter()
  const qc            = useQueryClient()
  const { user }      = useAuthStore()
  const [tab, setTab] = useState<Tab>('resumen')

  // Task form state
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskForm,     setTaskForm]     = useState(EMPTY_TASK)
  const [savingTask,   setSavingTask]   = useState(false)

  const { data: empresa, isLoading } = useQuery<Empresa>({
    queryKey: ['empresa', id],
    queryFn:  async () => {
      const res = await fetch(`/api/empresas/${id}`)
      if (!res.ok) throw new Error('No encontrada')
      return res.json().then((j: { data: Empresa }) => j.data)
    },
  })

  const { data: deals = [] } = useQuery<Deal[]>({
    queryKey: ['empresa-deals', id],
    queryFn:  async () => {
      const res = await fetch(`/api/deals?empresaId=${id}`)
      if (!res.ok) return []
      return res.json().then((j: any) => j.data ?? [])
    },
    enabled: tab === 'resumen' || tab === 'deals',
  })

  const { data: tickets = [] } = useQuery<Ticket[]>({
    queryKey: ['empresa-tickets', id],
    queryFn:  async () => {
      const res = await fetch(`/api/tickets?empresaId=${id}&limit=50`)
      if (!res.ok) return []
      return res.json().then((j: any) => j.data ?? [])
    },
    enabled: tab === 'resumen' || tab === 'tickets',
  })

  const { data: tareas = [] } = useQuery<Task[]>({
    queryKey: ['empresa-tareas', id],
    queryFn:  async () => {
      const res = await fetch(`/api/tareas?empresaId=${id}&limit=50`)
      if (!res.ok) return []
      return res.json().then((j: any) => j.data ?? [])
    },
    enabled: tab === 'resumen' || tab === 'tareas',
  })

  const { data: usersData } = useQuery({
    queryKey: ['usuarios-internos'],
    queryFn: async () => {
      const res = await fetch('/api/usuarios')
      if (!res.ok) return { data: [] }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
    enabled: showTaskForm,
  })
  const userOptions = [
    { value: '', label: 'Yo mismo' },
    ...((usersData?.data ?? []) as Array<{ id: string; name: string }>).map(u => ({ value: u.id, label: u.name })),
  ]

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskForm.title.trim()) { toast.error('El título es requerido'); return }
    setSavingTask(true)
    try {
      const res = await fetch('/api/tareas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:        taskForm.title.trim(),
          priority:     taskForm.priority,
          dueDate:      taskForm.dueDate || null,
          assignedToId: taskForm.assignedToId || user?.id,
          empresaId:    id,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al crear'); return }
      toast.success('Tarea creada')
      setTaskForm(EMPTY_TASK)
      setShowTaskForm(false)
      qc.invalidateQueries({ queryKey: ['empresa-tareas', id] })
    } catch { toast.error('Error') } finally { setSavingTask(false) }
  }

  const handleToggleTask = async (task: Task) => {
    const newStatus = task.status === 'HECHA' ? 'PENDIENTE' : 'HECHA'
    const res = await fetch(`/api/tareas/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) qc.invalidateQueries({ queryKey: ['empresa-tareas', id] })
    else toast.error('Error al actualizar')
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('¿Eliminar esta tarea?')) return
    const res = await fetch(`/api/tareas/${taskId}`, { method: 'DELETE' })
    if (res.ok) {
      qc.invalidateQueries({ queryKey: ['empresa-tareas', id] })
      toast.success('Tarea eliminada')
    } else {
      toast.error('Error al eliminar')
    }
  }

  const activeDeals   = deals.filter(d => d.stage !== 'GANADO' && d.stage !== 'PERDIDO')
  const openTickets   = tickets.filter(t => t.status === 'ABIERTO' || t.status === 'EN_PROCESO')
  const pendingTareas = tareas.filter(t => t.status !== 'HECHA')
  const pipelineValue = activeDeals.reduce((s, d) => s + d.amount * (d.probability / 100), 0)

  if (isLoading) return (
    <div className="space-y-4">
      <div className="h-8 w-48 rounded animate-pulse" style={{ background: 'var(--color-border)' }} />
      <div className="h-32 rounded-2xl animate-pulse" style={{ background: 'var(--color-border)' }} />
    </div>
  )

  if (!empresa) return (
    <div className="text-center py-20" style={{ color: 'var(--color-text-muted)' }}>
      Empresa no encontrada.
      <Button variant="ghost" className="ml-2" onClick={() => router.push('/clientes')}>Volver</Button>
    </div>
  )

  const TABS: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'resumen',      label: 'Resumen',     icon: <Building2 size={14} /> },
    { key: 'actividad',    label: 'Actividad',    icon: <ClipboardList size={14} /> },
    { key: 'deals',        label: 'Deals',        icon: <TrendingUp size={14} />,  count: activeDeals.length },
    { key: 'cotizaciones', label: 'Cotizaciones', icon: <FileText size={14} /> },
    { key: 'tickets',      label: 'Tickets',      icon: <LifeBuoy size={14} />,    count: openTickets.length },
    { key: 'tareas',       label: 'Tareas',       icon: <CheckSquare size={14} />, count: pendingTareas.length },
    { key: 'contactos',    label: 'Contactos',    icon: <Users size={14} />,       count: empresa.contactos?.length },
  ]

  return (
    <div className="space-y-5">
      <button onClick={() => router.push('/clientes')}
        className="flex items-center gap-2 text-sm hover:opacity-80 transition-colors"
        style={{ color: 'var(--color-text-muted)' }}>
        <ArrowLeft size={15} /> Clientes
      </button>

      {/* Header */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-primary)' }}>
            <Building2 size={26} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{empresa.name}</h1>
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'var(--color-primary)', color: '#fff' }}>
                <UserCheck size={11} /> Cliente
              </span>
            </div>
            {empresa.activity && <p className="text-sm mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{empresa.activity}</p>}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {(empresa.city || empresa.province) && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={13} />{[empresa.city, empresa.province].filter(Boolean).join(', ')}
                </span>
              )}
              {empresa.website && (
                <a href={empresa.website.startsWith('http') ? empresa.website : `https://${empresa.website}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:underline" style={{ color: 'var(--color-primary)' }}>
                  <Globe size={13} />{empresa.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4"
          style={{ borderTop: '1px solid var(--color-border)' }}>
          {[
            { label: 'Deals activos',    value: activeDeals.length,           icon: <TrendingUp size={14} />,  color: 'var(--color-primary)' },
            { label: 'Valor esperado',   value: formatCurrency(pipelineValue), icon: <DollarSign size={14} />, color: '#10b981' },
            { label: 'Tickets abiertos', value: openTickets.length,            icon: <LifeBuoy size={14} />,   color: openTickets.length > 0 ? '#ef4444' : '#10b981' },
            { label: 'Tareas pending.',  value: pendingTareas.length,          icon: <CheckSquare size={14} />,color: '#f59e0b' },
          ].map(k => (
            <div key={k.label} className="text-center">
              <p className="text-lg font-bold" style={{ color: k.color }}>{k.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{k.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto" style={{ borderBottom: '1px solid var(--color-border)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.key
                ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)] -mb-px'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}>
            {t.icon}{t.label}
            {typeof t.count === 'number' && t.count > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: tab === t.key ? 'var(--color-primary-light, rgba(99,102,241,0.12))' : 'var(--color-surface-raised)',
                  color: tab === t.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
                }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {tab === 'resumen' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Deals activos</h3>
            {activeDeals.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Sin deals. <button onClick={() => setTab('deals')} className="text-[var(--color-primary)] hover:underline">Ver historial</button></p>
            ) : activeDeals.slice(0,5).map(d => (
              <div key={d.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0"><p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{d.title}</p><p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{STAGE_LABELS[d.stage]}</p></div>
                <span className="text-sm font-bold shrink-0" style={{ color: 'var(--color-primary)' }}>{formatCurrency(d.amount, d.currency)}</span>
              </div>
            ))}
          </div>
          <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Tickets abiertos</h3>
            {openTickets.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No hay tickets abiertos.</p>
            ) : openTickets.slice(0,5).map(t => (
              <div key={t.id} className="flex items-center justify-between gap-2 cursor-pointer hover:opacity-80" onClick={() => router.push(`/tickets/${t.id}`)}>
                <p className="text-sm truncate flex-1" style={{ color: 'var(--color-text)' }}>
                  <span className="font-mono text-xs mr-1.5" style={{ color: 'var(--color-text-muted)' }}>#{String(t.number).padStart(4,'0')}</span>
                  {t.title}
                </p>
                <span className="text-[10px] shrink-0" style={{ color: 'var(--color-text-muted)' }}>{timeAgo(t.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'actividad'    && <EmpresaNotas empresaId={id} />}
      {tab === 'cotizaciones' && <EmpresaCotizaciones empresaId={id} />}

      {tab === 'deals' && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead><tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
              {['Deal','Etapa','Monto','Prob.','Responsable'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {deals.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin deals</td></tr>
              : deals.map(d => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>{d.title}</td>
                  <td className="px-4 py-3"><Badge variant={d.stage === 'GANADO' ? 'success' : d.stage === 'PERDIDO' ? 'danger' : 'info'} size="sm">{STAGE_LABELS[d.stage]}</Badge></td>
                  <td className="px-4 py-3 font-bold" style={{ color: 'var(--color-primary)' }}>{formatCurrency(d.amount, d.currency)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}><span className="flex items-center gap-1"><Target size={10} />{d.probability}%</span></td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>{d.owner?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'tickets' && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead><tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
              {['#','Título','Estado','Asignado','Creado'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {tickets.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin tickets</td></tr>
              : tickets.map(t => (
                <tr key={t.id} className="cursor-pointer hover:bg-[var(--color-surface-raised)] transition-colors" style={{ borderBottom: '1px solid var(--color-border)' }} onClick={() => router.push(`/tickets/${t.id}`)}>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>#{String(t.number).padStart(4,'0')}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>{t.title}</td>
                  <td className="px-4 py-3"><Badge variant={t.status==='ABIERTO'||t.status==='EN_PROCESO'?'danger':t.status==='RESUELTO'?'success':'neutral'} size="sm" dot>{t.status.replace('_',' ')}</Badge></td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>{t.assignedTo?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>{timeAgo(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'tareas' && (
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
              {tareas.length} tarea{tareas.length !== 1 ? 's' : ''}
            </p>
            <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setShowTaskForm(true)}>
              Nueva tarea
            </Button>
          </div>

          {/* List */}
          {tareas.length === 0 ? (
            <div className="rounded-2xl py-12 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <CheckSquare size={32} className="mx-auto mb-2" style={{ color: 'var(--color-text-subtle)' }} />
              <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>Sin tareas para este cliente</p>
              <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setShowTaskForm(true)}>Crear primera tarea</Button>
            </div>
          ) : (
            <div className="space-y-2">
              {tareas.map(t => (
                <div key={t.id}
                  className="rounded-xl px-4 py-3 flex items-start gap-3 group transition-opacity"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', opacity: t.status === 'HECHA' ? 0.6 : 1 }}
                >
                  <button
                    onClick={() => handleToggleTask(t)}
                    className="mt-0.5 shrink-0 transition-colors"
                    style={{ color: t.status === 'HECHA' ? '#10b981' : 'var(--color-text-subtle)' }}
                  >
                    {t.status === 'HECHA' ? <CheckSquare size={17} /> : <Square size={17} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${t.status === 'HECHA' ? 'line-through' : ''}`} style={{ color: 'var(--color-text)' }}>
                      {t.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                      {t.dueDate && (
                        <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--color-text-subtle)' }}>
                          <Clock size={9} />{formatDate(t.dueDate)}
                        </span>
                      )}
                      {t.assignedTo && (
                        <span className="text-[10px]" style={{ color: 'var(--color-text-subtle)' }}>{t.assignedTo.name}</span>
                      )}
                    </div>
                  </div>
                  <Badge variant={t.priority === 'URGENTE' ? 'danger' : t.priority === 'ALTA' ? 'warning' : 'neutral'} size="sm">
                    {t.priority}
                  </Badge>
                  <button
                    onClick={() => handleDeleteTask(t.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all shrink-0 mt-0.5"
                    style={{ color: 'var(--color-text-subtle)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-subtle)')}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Create task modal */}
          <Modal open={showTaskForm} onClose={() => { setShowTaskForm(false); setTaskForm(EMPTY_TASK) }} title="Nueva tarea" size="sm">
            <form onSubmit={handleCreateTask} className="space-y-3">
              <Input
                label="Título *"
                placeholder="Llamar al cliente, coordinar visita..."
                value={taskForm.title}
                onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Prioridad"
                  options={PRIORITY_OPTIONS}
                  value={taskForm.priority}
                  onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value as TaskPriority }))}
                />
                <Input
                  label="Fecha límite"
                  type="date"
                  value={taskForm.dueDate}
                  onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
              <Select
                label="Asignar a"
                options={userOptions}
                value={taskForm.assignedToId}
                onChange={e => setTaskForm(f => ({ ...f, assignedToId: e.target.value }))}
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" type="button" onClick={() => { setShowTaskForm(false); setTaskForm(EMPTY_TASK) }}>Cancelar</Button>
                <Button type="submit" loading={savingTask}>Crear tarea</Button>
              </div>
            </form>
          </Modal>
        </div>
      )}

      {tab === 'contactos' && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead><tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
              {['Nombre','Cargo','Mail','Teléfono'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {!empresa.contactos?.length ? <tr><td colSpan={4} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin contactos</td></tr>
              : empresa.contactos.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>{c.firstName} {c.lastName}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>{c.role ?? '—'}</td>
                  <td className="px-4 py-3">{c.email?<a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--color-primary)' }}><Mail size={11} />{c.email}</a>:<span style={{ color: 'var(--color-text-muted)' }}>—</span>}</td>
                  <td className="px-4 py-3 text-xs">{c.phone?<a href={`https://wa.me/${c.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-green-500 hover:text-green-400 transition-colors">{c.phone}</a>:'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
