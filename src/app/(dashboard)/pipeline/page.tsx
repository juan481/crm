'use client'

import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, DollarSign, Building2, ChevronRight, ChevronLeft, Trash2, TrendingUp, Target, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
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

export default function PipelinePage() {
  const qc        = useQueryClient()
  const { user }  = useAuthStore()
  const canDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'

  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState<DealFormState>(EMPTY_FORM)
  const [saving,   setSaving]   = useState(false)
  const [movingId, setMovingId] = useState<string | null>(null)

  // Drag state
  const [dragOverStage, setDragOverStage] = useState<DealStage | null>(null)
  const draggingId = useRef<string | null>(null)

  // Empresas for selector
  const { data: empresasData } = useQuery({
    queryKey: ['empresas-pipeline'],
    queryFn: async () => {
      const r = await fetch('/api/empresas?limit=200')
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

  const { data, isLoading } = useQuery<Deal[]>({
    queryKey: ['deals'],
    queryFn: async () => {
      const r = await fetch('/api/deals')
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

  const totalPipeline = deals
    .filter(d => d.stage !== 'PERDIDO')
    .reduce((acc, d) => acc + d.amount * (d.probability / 100), 0)

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
          ...(isClosing && { closedAt: new Date().toISOString() }),
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
            · Arrastrá las tarjetas para moverlas entre etapas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-[var(--color-text-muted)]">Valor esperado</p>
            <p className="text-lg font-bold text-[var(--color-text)]">{formatCurrency(totalPipeline)}</p>
          </div>
          <Button leftIcon={<Plus size={16} />} onClick={() => setShowForm(true)}>
            Nuevo Deal
          </Button>
        </div>
      </div>

      {/* Kanban board */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map(s => <Skeleton key={s.key} className="h-64 w-60 shrink-0 rounded-2xl" />)}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map(stage => {
            const columnDeals = dealsByStage[stage.key] ?? []
            const columnTotal = columnDeals.reduce((a, d) => a + d.amount, 0)
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
                    {columnTotal > 0 && (
                      <span className="text-[10px] opacity-70">{formatCurrency(columnTotal)}</span>
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
                            className="surface rounded-xl p-3 group relative select-none cursor-grab active:cursor-grabbing"
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

                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                              {stageIdx > 0 && (
                                <button onClick={() => moveStage(deal, 'prev')} disabled={!!movingId}
                                  className="p-1 rounded bg-[var(--color-border)] text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors"
                                  title="Etapa anterior">
                                  <ChevronLeft size={10} />
                                </button>
                              )}
                              {stageIdx < STAGES.length - 1 && (
                                <button onClick={() => moveStage(deal, 'next')} disabled={!!movingId}
                                  className="p-1 rounded bg-[var(--color-border)] text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors"
                                  title="Siguiente etapa">
                                  <ChevronRight size={10} />
                                </button>
                              )}
                              {canDelete && (
                                <button onClick={() => handleDelete(deal.id)}
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
    </div>
  )
}
