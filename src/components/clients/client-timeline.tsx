'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { StickyNote, Phone, Mail, Users, CheckSquare, Send, Plus } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { timeAgo, NOTE_TYPE_LABELS } from '@/lib/utils'
import type { Note, NoteType } from '@/types'
import toast from 'react-hot-toast'

const TYPE_ICONS: Record<NoteType, React.ReactNode> = {
  NOTE: <StickyNote size={14} />,
  CALL: <Phone size={14} />,
  EMAIL: <Mail size={14} />,
  MEETING: <Users size={14} />,
  TASK: <CheckSquare size={14} />,
}

const TYPE_COLORS: Record<NoteType, string> = {
  NOTE: 'bg-slate-500/10 text-slate-400',
  CALL: 'bg-green-500/10 text-green-400',
  EMAIL: 'bg-blue-500/10 text-blue-400',
  MEETING: 'bg-purple-500/10 text-purple-400',
  TASK: 'bg-orange-500/10 text-orange-400',
}

const TYPE_OPTIONS = [
  { value: 'NOTE', label: 'Nota' },
  { value: 'CALL', label: 'Llamada' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'MEETING', label: 'Reunión' },
  { value: 'TASK', label: 'Tarea' },
]

interface TimelineProps {
  clientId: string
  notes: Note[]
  onNoteAdded: (note: Note) => void
}

export function ClientTimeline({ clientId, notes, onNoteAdded }: TimelineProps) {
  const [adding, setAdding] = useState(false)
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: { content: '', type: 'NOTE' },
  })

  const onSubmit = async (data: { content: string; type: string }) => {
    const res = await fetch(`/api/clients/${clientId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); return }
    toast.success('Nota agregada')
    onNoteAdded(json.data)
    reset()
    setAdding(false)
  }

  return (
    <div className="space-y-4">
      {/* Add note button */}
      {!adding && (
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Plus size={14} />}
          onClick={() => setAdding(true)}
        >
          Agregar nota
        </Button>
      )}

      {/* Add note form */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="surface rounded-2xl p-4 space-y-3 overflow-hidden"
          >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <Select options={TYPE_OPTIONS} {...register('type')} />
              <Textarea
                placeholder="Escribe una nota, resumen de llamada, tarea..."
                {...register('content', { required: true })}
                rows={3}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" type="button" onClick={() => setAdding(false)}>
                  Cancelar
                </Button>
                <Button size="sm" type="submit" loading={isSubmitting} leftIcon={<Send size={13} />}>
                  Guardar
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes list */}
      <div className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-6">
            Sin actividad registrada aún
          </p>
        ) : (
          notes.map((note, i) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex gap-3"
            >
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    TYPE_COLORS[note.type as NoteType] ?? TYPE_COLORS.NOTE
                  }`}
                >
                  {TYPE_ICONS[note.type as NoteType] ?? TYPE_ICONS.NOTE}
                </div>
                {i < notes.length - 1 && (
                  <div className="w-px flex-1 bg-[var(--color-border)] my-1 min-h-[16px]" />
                )}
              </div>

              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-[var(--color-text-subtle)]">
                    {NOTE_TYPE_LABELS[note.type as NoteType]}
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
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
