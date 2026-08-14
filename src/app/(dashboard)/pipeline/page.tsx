'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, DollarSign, Building2, ChevronRight, ChevronLeft, Trash2, TrendingUp, Target, User, AlertTriangle, Calculator, CalendarClock, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatMultiCurrency, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import { DealNotas } from '@/components/pipeline/deal-notas'
import type { Deal, DealStage } from '@/types'
import toast from 'react-hot-toast'

const STAGES: { key: DealStage; label: string; color: string; prob: number }[] = [
  { key: 'LEAD',        label: 'Lead',        color: 'bg-slate-500/15 text-slate-400 border-slate-500/20',     prob: 10  },
  { key: 'CONTACTADO',  label: 'Contactado',  color: 'bg-blue-500/15 text-blue-400 border-blue-500/20',        prob: 25  },
  { key: 'PROPUESTA',   label: 'Propuesta',   color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',  prob: 50  },
  { key: 'NEGOCIACION', label: 'Negociación', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',  prob: 75  },
  { key: 'GANADO',      label: 'Ganado',      color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', prob: 100 },
  { key: 'PERDIDO',     label: 'Perdido',     color: 'bg-red-500/15 text-red-400 border-red-500/20',           prob: 0   },
]

// Días sin cambios (updatedAt) para marcar una oportunidad como estancada.
// No aplica a etapas ya cerradas.
const STALE_DAYS = 14

function daysSinceUpdate(deal: Deal) {
  return Math.floor((Date.now() - new Date(deal.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
}

function isDealStale(deal: Deal) {
  return deal.stage !== 'GANADO' && deal.stage !== 'PERDIDO' && daysSinceUpdate(deal) >= STALE_DAYS
}

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'ARS', label: 'ARS' },
  { value: 'EUR', label: 'EUR' },
]

interface DealFormState {
  title:       string
  amount:      string
  currency:    string
  probability: string
  stage:       DealStage
  notes:       string
  empresaId:   string
}

const EMPTY_FORM: DealFormState = {
  title: '', amount: '', currency: 'USD', probability: '10', stage: 'LEAD', notes: '', empresaId: '',
}

function DealDetailModal({ dealId, onClose }: { dealId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<{ amount: string; probability: string; expectedCloseDate: string; notes: string } | null>(null)

  const { data, isLoading } = useQuery<Deal>({
    queryKey: ['deal', dealId],
    queryFn: async () => {
      const res = await fetch(`/api/deals/${dealId}`)
      if (!res.ok) throw new Error('Deal no encontrado')
      return res.json().then(j => j.data)
    },
    staleTime: 10 * 1000,
  })

  const d = draft ?? (data ? {
    amount: String(data.amount),
    probability: String(data.probability),
    expectedCloseDate: data.expectedCloseDate ? data.expectedCloseDate.slice(0, 10) : '',
    notes: data.notes ?? '',
  } : null)

  const handleSave = async () => {
    if (!d) return
    setSaving(true)
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(d.amount) || 0,
          probability: Number(d.probability) || 0,
          expectedCloseDate: d.expectedCloseDate || null,
          notes: d.notes.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al guardar'); return }
      toast.success('Deal actualizado')
      qc.invalidateQueries({ queryKey: ['deal', dealId] })
      qc.invalidateQueries({ queryKey: ['deals'] })
      setDraft(null)
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={data?.title ?? 'Oportunidad'} size="md">
      {isLoading || !data || !d ? (
        <div className="space-y-3">
          <Skeleton className="h-8 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {data.empresa && (
              <span className="flex items-center gap-1 font-semibold" style={{ color: 'var(--color-primary)' }}>
                <Building2 size={11} />{data.empresa.name}
              </span>
            )}
            {data.owner && <span className="flex items-center gap-1"><User size={11} />{data.owner.name}</span>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Monto"
              type="number" min="0" step="0.01"
              leftIcon={<DollarSign size={14} />}
              value={d.amount}
              onChange={e => setDraft({ ...d, amount: e.target.value })}
            />
            <Input
              label="Probabilidad %"
              type="number" min="0" max="100"
              value={d.probability}
              onChange={e => setDraft({ ...d, probability: e.target.value })}
            />
          </div>

          <Input
            label="Fecha estimada de cierre"
            type="date"
            leftIcon={<CalendarClock size={14} />}
            value={d.expectedCloseDate}
            onChange={e => setDraft({ ...d, expectedCloseDate: e.target.value })}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Notas</label>
            <textarea
              className="w-full rounded-xl border bg-[var(--color-surface)] text-[var(--color-text)] px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
              style={{ borderColor: 'var(--color-border)' }}
              rows={4}
              placeholder="Última llamada, próximos pasos, objeciones..."
              value={d.notes}
              onChange={e => setDraft({ ...d, notes: e.target.value })}
            />
          </div>

          <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
            Creado {formatDate(data.createdAt)}
            {data.closedAt && ` · Cerrado ${formatDate(data.closedAt)}`}
          </p>

          {data.cotizaciones && data.cotizaciones.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-subtle)' }}>
                Cotizaciones vinculadas
              </p>
              {data.cotizaciones.map(c => (
                <Link
                  key={c.id}
                  href={`/cotizaciones/${c.id}`}
                  className="flex items-center justify-between text-sm rounded-lg px-2.5 py-1.5 hover:bg-[var(--color-surface-raised)] transition-colors"
                >
                  <span style={{ color: 'var(--color-text)' }}>{c.ref}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>{formatCurrency(c.finalTotal, c.currency)}</span>
                </Link>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <Link
              href={`/cotizador?dealId=${dealId}${data.empresa ? `&empresaId=${data.empresa.id}` : ''}`}
              className="flex items-center gap-1.5 text-sm font-medium hover:underline"
              style={{ color: 'var(--color-primary)' }}
            >
              <Calculator size={14} />Generar cotización
            </Link>
            <Button onClick={handleSave} loading={saving}>Guardar cambios</Button>
          </div>

          <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <DealNotas dealId={dealId} />
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function PipelinePage() {
  const qc        = useQueryClient()
  const { user }  = useAuthStore()
  const canDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'

  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState<DealFormState>(EMPTY_FORM)
  const [saving,   setSaving]   = useState(false)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)

  // Drag state
  const [dragOverStage, setDragOverStage] = useState<DealStage | null>(null)
  const draggingId = useRef<string | null>(null)

  // Empresas for selector
  const { data: empresasData } = useQuery({
    queryKey: ['empresas-pipeline'],
    queryFn: async () => {
      const r = await fetch('/api/empresas/options')
      if (!r.ok) return []
      return ((await r.json()).data ?? []) as Array<{ id: string; name: string; city?: string | null }>
    },
    staleTime: 5 * 60 * 1000,
  })
  const empresaOptions = [
    { value: '', label: 'Sin empresa' },
    ...((empresasData ?? []) as Array<{ id: string; name: string; city?: string | null }>)
      .map(e => ({ value: e.id, label: e.city ? `${e.name} (${e.city})` : e.name })),
  ]

  const { data, isLoading, isError } = useQuery<Deal[]>({
    queryKey: ['deals'],
    queryFn: async () => {
      // Sin este límite explícito, el default de la API (50) corta justo los
      // deals hace más tiempo sin actividad — los más "estancados" — porque
      // el orden es updatedAt desc.
      const r = await fetch('/api/deals?limit=2000')
      if (!r.ok) throw new Error('Error al cargar pipeline')
      return (await r.json()).data
    },
    staleTime: 30 * 1000,
  })

  const deals        = data ?? []
  const dealsByStage = STAGES.reduce((acc, s) => {
    acc[s.key] = deals.filter(d => d.stage === s.key)
    return acc
  }, {} as Record<DealStage, Deal[]>)

  // Agrupado por moneda, nunca sumado entre monedas — un deal en USD y
  // otro en ARS no son la misma unidad (mismo criterio que ya usa el
  // dashboard vía formatMultiCurrency; acá faltaba, y el total mostraba
  // una cifra sin sentido de negocio si había deals en más de una moneda).
  const totalPipelineByCurrency = deals
    .filter(d => d.stage !== 'PERDIDO')
    .reduce((acc, d) => {
      acc[d.currency] = (acc[d.currency] ?? 0) + d.amount * (d.probability / 100)
      return acc
    }, {} as Record<string, number>)

  // ── Create deal ───────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('El título es requerido'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/deals', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       form.title.trim(),
          amount:      Number(form.amount) || 0,
          currency:    form.currency,
          probability: Number(form.probability) || 10,
          stage:       form.stage,
          notes:       form.notes.trim() || null,
          empresaId:   form.empresaId || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success('Deal creado')
      setForm(EMPTY_FORM)
      setShowForm(false)
      qc.invalidateQueries({ queryKey: ['deals'] })
    } catch { toast.error('Error') } finally { setSaving(false) }
  }

  // ── Move stage (arrow buttons) ────────────────────────────────────────────
  const moveStage = async (deal: Deal, direction: 'prev' | 'next') => {
    const idx    = STAGES.findIndex(s => s.key === deal.stage)
    const newIdx = direction === 'next' ? idx + 1 : idx - 1
    if (newIdx < 0 || newIdx >= STAGES.length) return
    await patchStage(deal.id, STAGES[newIdx].key, STAGES[newIdx].prob)
  }

  const patchStage = async (dealId: string, newStage: DealStage, prob: number) => {
    setMovingId(dealId)
    try {
      const isClosing = newStage === 'GANADO' || newStage === 'PERDIDO'
      const res = await fetch(`/api/deals/${dealId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage:       newStage,
          probability: prob,
          // Al reabrir un deal ya cerrado (mover de GANADO/PERDIDO de
          // vuelta a una etapa activa) hay que limpiar closedAt
          // explícitamente — el backend lo soporta si se lo mandan, pero
          // antes acá sólo se enviaba al CERRAR, nunca al reabrir. Un deal
          // reabierto seguía mostrando "Cerrado [fecha vieja]" en el
          // detalle aunque estuviera activo de nuevo.
          closedAt: isClosing ? new Date().toISOString() : null,
        }),
      })
      if (!res.ok) { const j = await res.json(); toast.error(j.error); return }
      qc.invalidateQueries({ queryKey: ['deals'] })
    } catch { toast.error('Error') } finally { setMovingId(null) }
  }

  // ── Drag & Drop handlers ──────────────────────────────────────────────────
  const onDragStart = (e: React.DragEvent, dealId: string) => {
    draggingId.current = dealId
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', dealId)
  }

  const onDragOver = (e: React.DragEvent, stageKey: DealStage) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStage(stageKey)
  }

  const onDragLeave = () => setDragOverStage(null)

  const onDrop = async (e: React.DragEvent, stageKey: DealStage) => {
    e.preventDefault()
    setDragOverStage(null)
    const dealId = draggingId.current || e.dataTransfer.getData('text/plain')
    if (!dealId) return
    const deal = deals.find(d => d.id === dealId)
    if (!deal || deal.stage === stageKey) return
    const stageInfo = STAGES.find(s => s.key === stageKey)!
    await patchStage(dealId, stageKey, stageInfo.prob)
    draggingId.current = null
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este deal? Esta acción no se puede deshacer.')) return
    const res = await fetch(`/api/deals/${id}`, { method: 'DELETE' })
    if (res.ok) { qc.invalidateQueries({ queryKey: ['deals'] }); toast.success('Deal eliminado') }
  }

  const field = (key: keyof DealFormState) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Pipeline de Ventas</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {deals.filter(d => d.stage !== 'PERDIDO' && d.stage !== 'GANADO').length} deals activos
            {deals.some(isDealStale) && (
              <span className="text-amber-400"> · {deals.filter(isDealStale).length} estancadas (+{STALE_DAYS}d sin actividad)</span>
            )}
            {' '}· Arrastrá las tarjetas para moverlas entre etapas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-[var(--color-text-muted)]">Valor esperado</p>
            <p className="text-lg font-bold text-[var(--color-text)]">{formatMultiCurrency(totalPipelineByCurrency)}</p>
          </div>
          <Button leftIcon={<Plus size={16} />} onClick={() => setShowForm(true)}>
            Nuevo Deal
          </Button>
        </div>
      </div>

      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          <AlertTriangle size={16} />
          Error al cargar los datos. Intentá de nuevo.
        </div>
      )}

      {/* Kanban board */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map(s => <Skeleton key={s.key} className="h-64 w-60 shrink-0 rounded-2xl" />)}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map(stage => {
            const columnDeals = dealsByStage[stage.key] ?? []
            // Mismo criterio que el total del header — agrupado por
            // moneda, nunca sumado entre monedas distintas.
            const columnTotalByCurrency = columnDeals.reduce((acc, d) => {
              acc[d.currency] = (acc[d.currency] ?? 0) + d.amount
              return acc
            }, {} as Record<string, number>)
            const isDragOver  = dragOverStage === stage.key
            return (
              <div
                key={stage.key}
                className="shrink-0 w-64 flex flex-col gap-2"
                onDragOver={e => onDragOver(e, stage.key)}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, stage.key)}
              >
                {/* Column header */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${stage.color}`}>
                  <span className="text-xs font-semibold">{stage.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{columnDeals.length}</span>
                    {Object.keys(columnTotalByCurrency).length > 0 && (
                      <span className="text-[10px] opacity-70">{formatMultiCurrency(columnTotalByCurrency)}</span>
                    )}
                  </div>
                </div>

                {/* Drop zone */}
                <div
                  className={`flex flex-col gap-2 min-h-[120px] rounded-xl transition-all duration-150 ${
                    isDragOver ? 'bg-[var(--color-primary)]/8 ring-2 ring-[var(--color-primary)]/30' : ''
                  }`}
                  style={{ padding: isDragOver ? '6px' : '0' }}
                >
                  <AnimatePresence initial={false}>
                    {columnDeals.map(deal => {
                      const stageIdx = STAGES.findIndex(s => s.key === deal.stage)
                      const stale = isDealStale(deal)
                      return (
                        <motion.div
                          key={deal.id}
                          layout
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                        >
                          {/* Inner div owns HTML5 drag — avoids type conflict with Framer Motion */}
                          <div
                            draggable
                            onDragStart={(e: React.DragEvent<HTMLDivElement>) => onDragStart(e, deal.id)}
                            onClick={() => setSelectedDealId(deal.id)}
                            className={`surface rounded-xl p-3 group relative select-none cursor-grab active:cursor-grabbing hover:border-[var(--color-border-strong)] transition-colors ${stale ? 'border-l-2 border-amber-400/60' : ''}`}
                            style={{ opacity: movingId === deal.id ? 0.5 : 1 }}
                          >
                            <p className="text-sm font-medium text-[var(--color-text)] mb-1.5 pr-5 leading-snug">
                              {deal.title}
                            </p>

                            {deal.empresa && (
                              <p className="text-[10px] font-semibold flex items-center gap-1 mb-1"
                                style={{ color: 'var(--color-primary)' }}>
                                <Building2 size={9} />{deal.empresa.name}
                              </p>
                            )}

                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold flex items-center gap-1"
                                style={{ color: 'var(--color-text-muted)' }}>
                                <DollarSign size={10} />{formatCurrency(deal.amount, deal.currency)}
                              </span>
                              {deal.probability > 0 && (
                                <span className="text-[10px] flex items-center gap-0.5"
                                  style={{ color: 'var(--color-text-subtle)' }}>
                                  <Target size={9} />{deal.probability}%
                                </span>
                              )}
                            </div>

                            {deal.owner && (
                              <p className="text-[10px] flex items-center gap-1 mt-1"
                                style={{ color: 'var(--color-text-subtle)' }}>
                                <User size={9} />{deal.owner.name}
                              </p>
                            )}

                            {stale && (
                              <p className="text-[10px] flex items-center gap-1 mt-1 font-medium text-amber-400">
                                <Clock size={9} />{daysSinceUpdate(deal)} días sin actividad
                              </p>
                            )}

                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                              {stageIdx > 0 && (
                                <button onClick={e => { e.stopPropagation(); moveStage(deal, 'prev') }} disabled={!!movingId}
                                  className="p-1 rounded bg-[var(--color-border)] text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors"
                                  title="Etapa anterior">
                                  <ChevronLeft size={10} />
                                </button>
                              )}
                              {stageIdx < STAGES.length - 1 && (
                                <button onClick={e => { e.stopPropagation(); moveStage(deal, 'next') }} disabled={!!movingId}
                                  className="p-1 rounded bg-[var(--color-border)] text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors"
                                  title="Siguiente etapa">
                                  <ChevronRight size={10} />
                                </button>
                              )}
                              {canDelete && (
                                <button onClick={e => { e.stopPropagation(); handleDelete(deal.id) }}
                                  className="p-1 rounded bg-[var(--color-border)] text-[var(--color-text-subtle)] hover:text-red-400 transition-colors">
                                  <Trash2 size={10} />
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>

                  {columnDeals.length === 0 && (
                    <div className={`border-2 border-dashed rounded-xl h-20 flex items-center justify-center transition-colors ${
                      isDragOver ? 'border-[var(--color-primary)]/50' : 'border-[var(--color-border)]'
                    }`}>
                      <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                        {isDragOver ? 'Soltar aquí' : 'Sin deals'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create deal modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nuevo Deal" size="sm">
        <form onSubmit={handleCreate} className="space-y-3">
          <Input label="Título *" placeholder="Ej: Instalación CCTV — Empresa XYZ" {...field('title')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Monto" type="number" min="0" step="0.01" placeholder="0.00"
              leftIcon={<DollarSign size={14} />} {...field('amount')} />
            <Select label="Moneda" options={CURRENCY_OPTIONS} value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Etapa"
              options={STAGES.map(s => ({ value: s.key, label: s.label }))}
              value={form.stage}
              onChange={e => {
                const s = STAGES.find(x => x.key === e.target.value)
                setForm(f => ({ ...f, stage: e.target.value as DealStage, probability: String(s?.prob ?? 10) }))
              }}
            />
            <Input label="Probabilidad %" type="number" min="0" max="100" placeholder="10"
              {...field('probability')} />
          </div>
          <Select
            label="Empresa (opcional)"
            options={empresaOptions}
            value={form.empresaId}
            onChange={e => setForm(f => ({ ...f, empresaId: e.target.value }))}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Notas</label>
            <textarea
              className="w-full rounded-xl border bg-[var(--color-surface)] text-[var(--color-text)] px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
              style={{ borderColor: 'var(--color-border)' }}
              rows={2}
              {...field('notes')}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Crear Deal</Button>
          </div>
        </form>
      </Modal>

      {/* Deal detail modal */}
      {selectedDealId && (
        <DealDetailModal dealId={selectedDealId} onClose={() => setSelectedDealId(null)} />
      )}
    </div>
  )
}
