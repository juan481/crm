'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import {
  StickyNote, Phone, Mail, Users, CheckSquare, Send, Plus,
  MessageCircle, Clock, ChevronDown, ChevronUp, Paperclip, X,
} from 'lucide-react'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { timeAgo, NOTE_TYPE_LABELS } from '@/lib/utils'
import type { Note, NoteType } from '@/types'
import toast from 'react-hot-toast'

// ─── Type metadata ─────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, React.ReactNode> = {
  NOTE:    <StickyNote    size={14} />,
  CALL:    <Phone         size={14} />,
  EMAIL:   <Mail          size={14} />,
  MEETING: <Users         size={14} />,
  TASK:    <CheckSquare   size={14} />,
  CHAT:    <MessageCircle size={14} />,
}

const TYPE_COLORS: Record<string, string> = {
  NOTE:    'bg-slate-500/10 text-slate-400',
  CALL:    'bg-green-500/10 text-green-400',
  EMAIL:   'bg-blue-500/10 text-blue-400',
  MEETING: 'bg-purple-500/10 text-purple-400',
  TASK:    'bg-orange-500/10 text-orange-400',
  CHAT:    'bg-teal-500/10 text-teal-400',
}

const TYPE_OPTIONS = [
  { value: 'NOTE',    label: 'Nota' },
  { value: 'CALL',    label: 'Llamada' },
  { value: 'EMAIL',   label: 'Email' },
  { value: 'MEETING', label: 'Reunión' },
  { value: 'TASK',    label: 'Tarea' },
  { value: 'CHAT',    label: 'Chat' },
]

const COMPLEXITY_LABELS: Record<string, string> = {
  BAJA:  'Baja',
  MEDIA: 'Media',
  ALTA:  'Alta',
}

const COMPLEXITY_COLORS: Record<string, string> = {
  BAJA:  'bg-green-500/10 text-green-400',
  MEDIA: 'bg-amber-500/10 text-amber-400',
  ALTA:  'bg-red-500/10 text-red-400',
}

interface NoteMetadata {
  estimatedHours?:   number
  estimatedMinutes?: number
  complexity?:       'BAJA' | 'MEDIA' | 'ALTA'
  estimatedCost?:    number
  imageUrl?:         string
}

function parseMeta(raw: string | null | undefined): NoteMetadata | null {
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface TimelineProps {
  clientId:    string
  notes:       Note[]
  onNoteAdded: (note: Note) => void
}

// ─── Component ─────────────────────────────────────────────────────────────

export function ClientTimeline({ clientId, notes, onNoteAdded }: TimelineProps) {
  const [adding, setAdding]               = useState(false)
  const [filter, setFilter]               = useState<string>('ALL')
  const [showEstimate, setShowEstimate]   = useState(false)
  const [estHours,   setEstHours]         = useState('')
  const [estMinutes, setEstMinutes]       = useState('0')
  const [complexity, setComplexity]       = useState('MEDIA')
  const [estCost,    setEstCost]          = useState('')
  const [emailFile,  setEmailFile]        = useState<File | null>(null)
  const [uploading,  setUploading]        = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm({
    defaultValues: { content: '', type: 'NOTE' },
  })
  const currentType = watch('type')

  const resetForm = () => {
    reset()
    setShowEstimate(false)
    setEstHours(''); setEstMinutes('0'); setComplexity('MEDIA'); setEstCost('')
    setEmailFile(null)
    setAdding(false)
  }

  const onSubmit = async (data: { content: string; type: string }) => {
    // Upload screenshot for EMAIL type
    let imageUrl: string | undefined
    if (data.type === 'EMAIL' && emailFile) {
      setUploading(true)
      try {
        const fd = new FormData()
        fd.append('file', emailFile)
        fd.append('clientId', clientId)
        const upRes  = await fetch('/api/documentos/upload', { method: 'POST', body: fd })
        const upJson = await upRes.json()
        if (!upRes.ok) { toast.error(upJson.error ?? 'Error al subir imagen'); setUploading(false); return }
        imageUrl = upJson.data.url
      } catch {
        toast.error('Error al subir imagen')
        setUploading(false)
        return
      }
      setUploading(false)
    }

    // Build metadata
    const meta: NoteMetadata = {}
    if (showEstimate) {
      if (estHours)      meta.estimatedHours   = Number(estHours)
      if (estMinutes !== '0') meta.estimatedMinutes = Number(estMinutes)
      if (complexity)    meta.complexity        = complexity as NoteMetadata['complexity']
      if (estCost)       meta.estimatedCost     = Number(estCost)
    }
    if (imageUrl) meta.imageUrl = imageUrl

    const res = await fetch(`/api/clients/${clientId}/notes`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content:  data.content,
        type:     data.type,
        metadata: Object.keys(meta).length > 0 ? JSON.stringify(meta) : undefined,
      }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); return }
    toast.success('Interacción guardada')
    onNoteAdded(json.data)
    resetForm()
  }

  // ─── Derived ─────────────────────────────────────────────────────────────

  const filtered = filter === 'ALL' ? notes : notes.filter(n => n.type === filter)

  const countFor = (t: string) => notes.filter(n => n.type === t).length

  return (
    <div className="space-y-4">

      {/* Add button */}
      {!adding && (
        <Button variant="secondary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setAdding(true)}>
          Registrar interacción
        </Button>
      )}

      {/* ─── Form ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="surface rounded-2xl p-4 space-y-3 overflow-hidden"
          >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">

              {/* Type selector */}
              <Select options={TYPE_OPTIONS} {...register('type')} />

              {/* Textarea with dynamic placeholder */}
              <Textarea
                placeholder={
                  currentType === 'EMAIL'   ? 'Resumen o descripción del email...' :
                  currentType === 'CHAT'    ? 'Resumen del chat (WhatsApp, Telegram, etc.)...' :
                  currentType === 'CALL'    ? 'Resumen de la llamada, temas tratados...' :
                  currentType === 'MEETING' ? 'Acuerdos de la reunión, próximos pasos...' :
                  currentType === 'TASK'    ? 'Descripción de la tarea a realizar...' :
                                             'Escribe una nota, observación o seguimiento...'
                }
                {...register('content', { required: true })}
                rows={3}
              />

              {/* ── EMAIL: capture upload ─────────────────────────────────── */}
              {currentType === 'EMAIL' && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-[var(--color-text-muted)]">Captura del email (opcional)</p>
                  {emailFile ? (
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] surface-raised rounded-xl px-3 py-2.5">
                      <Mail size={12} className="shrink-0" />
                      <span className="flex-1 truncate">{emailFile.name}</span>
                      <button type="button" onClick={() => setEmailFile(null)} className="text-red-400 hover:text-red-300 transition-colors">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-2 text-xs w-full px-3 py-2.5 rounded-xl border border-dashed transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-primary)] border-[var(--color-border)] hover:border-[var(--color-primary)]"
                    >
                      <Paperclip size={13} />
                      Adjuntar captura de pantalla
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => setEmailFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              )}

              {/* ── Time estimate toggle ──────────────────────────────────── */}
              <button
                type="button"
                onClick={() => setShowEstimate(v => !v)}
                className="flex items-center gap-1.5 text-xs transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
              >
                <Clock size={12} />
                {showEstimate ? 'Quitar estimación de tiempo' : 'Agregar estimación de tiempo'}
                {showEstimate ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>

              {/* ── Estimate fields ───────────────────────────────────────── */}
              <AnimatePresence>
                {showEstimate && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-xl p-3 space-y-3" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
                      <p className="text-xs font-semibold text-[var(--color-text-subtle)]">Estimación de Tiempo / Cotización</p>
                      <div className="grid grid-cols-2 gap-3">

                        <div>
                          <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Horas</label>
                          <input
                            type="number" min="0" max="999" placeholder="0"
                            value={estHours} onChange={e => setEstHours(e.target.value)}
                            className="w-full text-sm rounded-xl px-3 py-2 outline-none"
                            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                          />
                        </div>

                        <div>
                          <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Minutos</label>
                          <select
                            value={estMinutes} onChange={e => setEstMinutes(e.target.value)}
                            className="w-full text-sm rounded-xl px-3 py-2 outline-none"
                            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                          >
                            <option value="0">0 min</option>
                            <option value="15">15 min</option>
                            <option value="30">30 min</option>
                            <option value="45">45 min</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Complejidad</label>
                          <select
                            value={complexity} onChange={e => setComplexity(e.target.value)}
                            className="w-full text-sm rounded-xl px-3 py-2 outline-none"
                            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                          >
                            <option value="BAJA">Baja</option>
                            <option value="MEDIA">Media</option>
                            <option value="ALTA">Alta</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Costo estimado ($)</label>
                          <input
                            type="number" min="0" step="0.01" placeholder="0.00"
                            value={estCost} onChange={e => setEstCost(e.target.value)}
                            className="w-full text-sm rounded-xl px-3 py-2 outline-none"
                            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                          />
                        </div>

                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" type="button" onClick={resetForm}>Cancelar</Button>
                <Button size="sm" type="submit" loading={isSubmitting || uploading} leftIcon={<Send size={13} />}>
                  Guardar
                </Button>
              </div>

            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Filter bar ───────────────────────────────────────────────────── */}
      {notes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {/* All */}
          <button
            onClick={() => setFilter('ALL')}
            className="text-xs px-2.5 py-1 rounded-full transition-all font-medium"
            style={{
              background: filter === 'ALL' ? 'var(--color-primary)' : 'var(--color-surface-raised)',
              color:      filter === 'ALL' ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            Todos ({notes.length})
          </button>

          {/* Per type — only show if count > 0 */}
          {TYPE_OPTIONS.filter(o => countFor(o.value) > 0).map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-all font-medium"
              style={{
                background: filter === opt.value ? 'var(--color-primary)' : 'var(--color-surface-raised)',
                color:      filter === opt.value ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              {TYPE_ICONS[opt.value]}
              {opt.label} ({countFor(opt.value)})
            </button>
          ))}
        </div>
      )}

      {/* ─── Notes list ───────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-6">
            {filter === 'ALL'
              ? 'Sin actividad registrada aún'
              : `No hay registros de tipo "${NOTE_TYPE_LABELS[filter] ?? filter}"`}
          </p>
        ) : (
          filtered.map((note, i) => {
            const meta = parseMeta(note.metadata)
            const hasEstimate = meta && (
              meta.estimatedHours !== undefined ||
              meta.estimatedMinutes !== undefined ||
              meta.estimatedCost !== undefined ||
              meta.complexity
            )

            return (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex gap-3"
              >
                {/* Timeline icon + line */}
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${TYPE_COLORS[note.type] ?? TYPE_COLORS.NOTE}`}>
                    {TYPE_ICONS[note.type] ?? TYPE_ICONS.NOTE}
                  </div>
                  {i < filtered.length - 1 && (
                    <div className="w-px flex-1 bg-[var(--color-border)] my-1 min-h-[16px]" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-2">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-semibold text-[var(--color-text-subtle)]">
                      {NOTE_TYPE_LABELS[note.type] ?? note.type}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-subtle)]">·</span>
                    <span className="text-xs text-[var(--color-text-subtle)]">{timeAgo(note.createdAt)}</span>
                    {note.user && (
                      <>
                        <span className="text-[10px] text-[var(--color-text-subtle)]">·</span>
                        <span className="text-xs text-[var(--color-text-subtle)]">{note.user.name}</span>
                      </>
                    )}
                  </div>

                  <p className="text-sm text-[var(--color-text)] leading-relaxed whitespace-pre-line">
                    {note.content}
                  </p>

                  {/* ── Time estimate badges ──────────────────────────────── */}
                  {hasEstimate && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(meta.estimatedHours !== undefined || meta.estimatedMinutes !== undefined) && (
                        <span className="flex items-center gap-1 text-[11px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full">
                          <Clock size={10} />
                          {meta.estimatedHours ?? 0}h {meta.estimatedMinutes ?? 0}min
                        </span>
                      )}
                      {meta.complexity && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${COMPLEXITY_COLORS[meta.complexity]}`}>
                          Complejidad {COMPLEXITY_LABELS[meta.complexity]}
                        </span>
                      )}
                      {meta.estimatedCost !== undefined && (
                        <span className="text-[11px] bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded-full">
                          ${meta.estimatedCost.toLocaleString('es-AR')}
                        </span>
                      )}
                    </div>
                  )}

                  {/* ── Email screenshot ──────────────────────────────────── */}
                  {meta?.imageUrl && (
                    <div className="mt-2">
                      <a href={meta.imageUrl} target="_blank" rel="noopener noreferrer">
                        <img
                          src={meta.imageUrl}
                          alt="Captura de email"
                          className="max-h-48 rounded-xl border object-cover hover:opacity-90 transition-opacity cursor-zoom-in"
                          style={{ borderColor: 'var(--color-border)' }}
                        />
                      </a>
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}
