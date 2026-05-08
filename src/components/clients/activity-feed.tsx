'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  StickyNote, Phone, Mail, Users, CheckSquare, Send, Plus,
  UserPlus, DollarSign, FileUp, RefreshCw, Trash2, Edit3,
  Activity,
} from 'lucide-react'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo, formatDateTime } from '@/lib/utils'
import type { ActivityLog, ActivityAction } from '@/types'
import toast from 'react-hot-toast'

const ACTION_META: Record<ActivityAction, { icon: React.ReactNode; color: string; label: string }> = {
  NOTE:             { icon: <StickyNote size={13} />,  color: 'bg-slate-500/15 text-slate-400',   label: 'Nota' },
  CALL:             { icon: <Phone size={13} />,        color: 'bg-green-500/15 text-green-400',   label: 'Llamada' },
  EMAIL:            { icon: <Mail size={13} />,         color: 'bg-blue-500/15 text-blue-400',     label: 'Email' },
  MEETING:          { icon: <Users size={13} />,        color: 'bg-purple-500/15 text-purple-400', label: 'Reunión' },
  TASK:             { icon: <CheckSquare size={13} />,  color: 'bg-orange-500/15 text-orange-400', label: 'Tarea' },
  CLIENT_CREATED:   { icon: <UserPlus size={13} />,     color: 'bg-emerald-500/15 text-emerald-400', label: 'Creación' },
  CLIENT_UPDATED:   { icon: <Edit3 size={13} />,        color: 'bg-sky-500/15 text-sky-400',       label: 'Actualización' },
  CLIENT_DELETED:   { icon: <Trash2 size={13} />,       color: 'bg-red-500/15 text-red-400',       label: 'Eliminación' },
  SALE_REGISTERED:  { icon: <DollarSign size={13} />,   color: 'bg-yellow-500/15 text-yellow-400', label: 'Venta' },
  DOCUMENT_UPLOADED:{ icon: <FileUp size={13} />,       color: 'bg-indigo-500/15 text-indigo-400', label: 'Documento' },
  STATUS_CHANGED:   { icon: <RefreshCw size={13} />,    color: 'bg-teal-500/15 text-teal-400',     label: 'Estado' },
}

const MANUAL_ACTIONS: ActivityAction[] = ['NOTE', 'CALL', 'EMAIL', 'MEETING', 'TASK']

const TYPE_OPTIONS = MANUAL_ACTIONS.map((a) => ({ value: a, label: ACTION_META[a].label }))

const AUTO_ACTIONS: ActivityAction[] = [
  'CLIENT_CREATED', 'CLIENT_UPDATED', 'CLIENT_DELETED',
  'SALE_REGISTERED', 'DOCUMENT_UPLOADED', 'STATUS_CHANGED',
]

interface ActivityFeedProps {
  clientId: string
}

export function ActivityFeed({ clientId }: ActivityFeedProps) {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ description: '', action: 'NOTE' as ActivityAction })

  const { data, isLoading } = useQuery<ActivityLog[]>({
    queryKey: ['activity', clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/activity`)
      if (!res.ok) throw new Error('Error al cargar actividad')
      const json = await res.json()
      return json.data
    },
    staleTime: 30 * 1000,
  })

  const logs = data ?? []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.description.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: form.description, action: form.action }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success('Entrada agregada')
      setForm({ description: '', action: 'NOTE' })
      setAdding(false)
      qc.invalidateQueries({ queryKey: ['activity', clientId] })
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-1.5">
          <Activity size={14} />
          Actividad
        </h3>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs text-[var(--color-primary)] hover:opacity-80 flex items-center gap-1 transition-opacity"
          >
            <Plus size={12} /> Agregar
          </button>
        )}
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="surface rounded-xl p-3 space-y-2.5">
              <Select
                options={TYPE_OPTIONS}
                value={form.action}
                onChange={(e) => setForm((f) => ({ ...f, action: e.target.value as ActivityAction }))}
              />
              <Textarea
                placeholder="Descripción de la actividad..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" type="button" onClick={() => setAdding(false)}>
                  Cancelar
                </Button>
                <Button size="sm" type="submit" loading={submitting} leftIcon={<Send size={12} />}>
                  Guardar
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-0">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3 py-3">
              <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3.5 w-full" />
              </div>
            </div>
          ))
        ) : logs.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
            Sin actividad registrada aún
          </p>
        ) : (
          logs.map((log, i) => {
            const meta = ACTION_META[log.action] ?? ACTION_META.NOTE
            const isAuto = AUTO_ACTIONS.includes(log.action)

            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className="flex gap-3 py-3 relative"
              >
                {/* Timeline connector */}
                {i < logs.length - 1 && (
                  <div className="absolute left-3.5 top-10 bottom-0 w-px bg-[var(--color-border)]" />
                )}

                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                  {meta.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-0.5">
                    <span className="text-[11px] font-semibold text-[var(--color-text-subtle)] uppercase tracking-wide">
                      {meta.label}
                    </span>
                    {isAuto && (
                      <span className="text-[10px] px-1.5 py-px rounded bg-[var(--color-border)] text-[var(--color-text-subtle)]">
                        automático
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--color-text-subtle)]">·</span>
                    <span
                      className="text-[10px] text-[var(--color-text-subtle)]"
                      title={formatDateTime(log.createdAt)}
                    >
                      {timeAgo(log.createdAt)}
                    </span>
                    {log.user && (
                      <>
                        <span className="text-[10px] text-[var(--color-text-subtle)]">·</span>
                        <span className="text-[10px] text-[var(--color-text-subtle)]">{log.user.name}</span>
                      </>
                    )}
                  </div>
                  <p className="text-sm text-[var(--color-text)] leading-snug whitespace-pre-line break-words">
                    {log.description}
                  </p>
                </div>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}
