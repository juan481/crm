'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, CalendarDays, MapPin, Users, Power, Trash2, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import type { Event } from '@/types'
import toast from 'react-hot-toast'

interface EventFormState {
  name: string
  description: string
  eventDate: string
  location: string
}

const EMPTY_FORM: EventFormState = { name: '', description: '', eventDate: '', location: '' }

export default function EventosPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<EventFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data, isLoading } = useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: async () => {
      const res = await fetch('/api/eventos')
      if (!res.ok) throw new Error('Error al cargar eventos')
      const json = await res.json()
      return json.data
    },
    staleTime: 30 * 1000,
  })

  const events = data ?? []

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          eventDate: form.eventDate || null,
          location: form.location.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success('Evento creado')
      setForm(EMPTY_FORM)
      setShowForm(false)
      qc.invalidateQueries({ queryKey: ['events'] })
    } catch {
      toast.error('Error al crear')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/eventos/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) { const j = await res.json(); toast.error(j.error); return }
      toast.success('Evento eliminado')
      setDeleteTarget(null)
      qc.invalidateQueries({ queryKey: ['events'] })
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  const field = (key: keyof EventFormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Eventos</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {events.length > 0 ? `${events.length} evento${events.length !== 1 ? 's' : ''}` : 'Sin eventos aún'}
          </p>
        </div>
        {canManage && (
          <Button leftIcon={<Plus size={16} />} onClick={() => setShowForm(true)}>
            Nuevo Evento
          </Button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="surface rounded-2xl p-16 text-center">
          <CalendarDays className="mx-auto mb-3 text-[var(--color-text-subtle)]" size={40} />
          <p className="text-[var(--color-text-muted)]">No hay eventos creados aún</p>
          {canManage && (
            <Button className="mt-4" leftIcon={<Plus size={14} />} onClick={() => setShowForm(true)}>
              Crear primer evento
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="surface rounded-2xl p-5 flex flex-col gap-3 hover:border-[var(--color-border-strong)] transition-colors cursor-pointer group"
              onClick={() => router.push(`/eventos/${event.id}`)}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[var(--color-text)] truncate">{event.name}</h3>
                  {event.description && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-2">{event.description}</p>
                  )}
                </div>
                <Badge variant={event.isActive ? 'success' : 'neutral'} size="sm" dot>
                  {event.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>

              {/* Meta */}
              <div className="space-y-1.5">
                {event.eventDate && (
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <CalendarDays size={12} />
                    {formatDate(event.eventDate)}
                  </div>
                )}
                {event.location && (
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <MapPin size={12} />
                    {event.location}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                  <Users size={12} />
                  {event._count?.attendees ?? 0} inscritos
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-[var(--color-border)]">
                <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-subtle)]">
                  <Globe size={11} />
                  Webhook disponible
                </div>
                {canManage && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(event) }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nuevo Evento" size="sm">
        <form onSubmit={handleCreate} className="space-y-3">
          <Input label="Nombre del evento *" placeholder="Conferencia Anual 2026" {...field('name')} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-muted)]">Descripción</label>
            <textarea
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
              placeholder="Descripción del evento..."
              rows={2}
              {...field('description')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha" type="datetime-local" {...field('eventDate')} />
            <Input label="Ubicación" placeholder="Buenos Aires, AR" leftIcon={<MapPin size={14} />} {...field('location')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Crear Evento</Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar Evento" size="sm">
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          ¿Eliminar <strong className="text-[var(--color-text)]">{deleteTarget?.name}</strong> y todos sus inscritos? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  )
}
