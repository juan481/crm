'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, CalendarDays, MapPin, Users, Globe, Copy, Check,
  Plus, Trash2, Power, Edit3, Mail, Phone, Building, Flag,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { Select } from '@/components/ui/select'
import { formatDate, formatDateTime, COUNTRIES } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import type { Event, EventAttendee } from '@/types'
import toast from 'react-hot-toast'

interface AttendeeFormState {
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  country: string
}

const EMPTY_ATTENDEE: AttendeeFormState = {
  firstName: '', lastName: '', email: '', phone: '', company: '', country: '',
}

const COUNTRY_OPTIONS = [
  { value: '', label: 'Seleccionar país...' },
  ...COUNTRIES.map((c) => ({ value: c, label: c })),
]

export default function EventoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'

  const [showAddAttendee, setShowAddAttendee] = useState(false)
  const [attendeeForm, setAttendeeForm] = useState<AttendeeFormState>(EMPTY_ATTENDEE)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<EventAttendee | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [togglingActive, setTogglingActive] = useState(false)

  const { data: event, isLoading } = useQuery<Event>({
    queryKey: ['event', id],
    queryFn: async () => {
      const res = await fetch(`/api/eventos/${id}`)
      if (!res.ok) throw new Error('Evento no encontrado')
      const json = await res.json()
      return json.data
    },
    staleTime: 30 * 1000,
  })

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/eventos/${id}?secret=${event?.webhookSecret ?? ''}`
    : ''

  const copyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('URL copiada')
  }

  const toggleActive = async () => {
    if (!event) return
    setTogglingActive(true)
    try {
      const res = await fetch(`/api/eventos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !event.isActive }),
      })
      if (!res.ok) { const j = await res.json(); toast.error(j.error); return }
      qc.invalidateQueries({ queryKey: ['event', id] })
      qc.invalidateQueries({ queryKey: ['events'] })
    } finally {
      setTogglingActive(false)
    }
  }

  const handleAddAttendee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!attendeeForm.firstName.trim() || !attendeeForm.lastName.trim()) {
      toast.error('Nombre y apellido son requeridos')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/eventos/${id}/inscritos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: attendeeForm.firstName.trim(),
          lastName: attendeeForm.lastName.trim(),
          email: attendeeForm.email.trim() || null,
          phone: attendeeForm.phone.trim() || null,
          company: attendeeForm.company.trim() || null,
          country: attendeeForm.country || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success('Inscrito agregado')
      setAttendeeForm(EMPTY_ATTENDEE)
      setShowAddAttendee(false)
      qc.invalidateQueries({ queryKey: ['event', id] })
      qc.invalidateQueries({ queryKey: ['events'] })
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAttendee = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/eventos/${id}/inscritos?attendeeId=${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) { const j = await res.json(); toast.error(j.error); return }
      toast.success('Inscrito eliminado')
      setDeleteTarget(null)
      qc.invalidateQueries({ queryKey: ['event', id] })
      qc.invalidateQueries({ queryKey: ['events'] })
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  const afield = (key: keyof AttendeeFormState) => ({
    value: attendeeForm[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setAttendeeForm((f) => ({ ...f, [key]: e.target.value })),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="text-center py-20">
        <p className="text-[var(--color-text-muted)]">Evento no encontrado</p>
        <Button variant="ghost" className="mt-4" onClick={() => router.push('/eventos')}>
          Volver a Eventos
        </Button>
      </div>
    )
  }

  const attendees = event.attendees ?? []

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href="/eventos"
            className="mt-1 p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-[var(--color-text)]">{event.name}</h1>
              <Badge variant={event.isActive ? 'success' : 'neutral'} dot>
                {event.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            {event.description && (
              <p className="text-sm text-[var(--color-text-muted)] mt-1">{event.description}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {event.eventDate && (
                <span className="text-xs text-[var(--color-text-subtle)] flex items-center gap-1">
                  <CalendarDays size={11} /> {formatDateTime(event.eventDate)}
                </span>
              )}
              {event.location && (
                <span className="text-xs text-[var(--color-text-subtle)] flex items-center gap-1">
                  <MapPin size={11} /> {event.location}
                </span>
              )}
              <span className="text-xs text-[var(--color-text-subtle)] flex items-center gap-1">
                <Users size={11} /> {attendees.length} inscritos
              </span>
            </div>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Power size={14} />}
              loading={togglingActive}
              onClick={toggleActive}
            >
              {event.isActive ? 'Desactivar' : 'Activar'}
            </Button>
          </div>
        )}
      </div>

      {/* Webhook section */}
      <div className="surface rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
            <Globe size={15} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Webhook de Inscripción</h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Integrá este endpoint en tu sitio web o WordPress para registrar inscripciones automáticamente
            </p>
          </div>
        </div>

        <div className="bg-[var(--color-bg)] rounded-xl p-3 flex items-center gap-2 border border-[var(--color-border)]">
          <code className="flex-1 text-xs text-[var(--color-text)] font-mono break-all">
            POST {webhookUrl}
          </code>
          <button
            onClick={copyWebhook}
            className="shrink-0 p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
        </div>

        <div className="text-xs text-[var(--color-text-subtle)] space-y-1">
          <p className="font-medium text-[var(--color-text-muted)]">Payload esperado (JSON):</p>
          <pre className="bg-[var(--color-bg)] rounded-lg p-2 border border-[var(--color-border)] overflow-x-auto">{`{
  "firstName": "Juan",
  "lastName": "García",
  "email": "juan@empresa.com",
  "phone": "+54 11 1234 5678",
  "company": "Empresa SA",
  "country": "Argentina"
}`}</pre>
        </div>
      </div>

      {/* Attendees */}
      <div className="surface rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[var(--color-text)] flex items-center gap-2">
            <Users size={16} />
            Inscritos
            <span className="text-sm font-normal text-[var(--color-text-muted)]">({attendees.length})</span>
          </h3>
          {canManage && (
            <Button size="sm" variant="secondary" leftIcon={<Plus size={14} />} onClick={() => setShowAddAttendee(true)}>
              Agregar
            </Button>
          )}
        </div>

        {attendees.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
            Sin inscritos aún. Los registros del webhook aparecerán aquí automáticamente.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-2 pr-4 text-xs font-medium text-[var(--color-text-subtle)]">Nombre</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-[var(--color-text-subtle)]">Email</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-[var(--color-text-subtle)]">Empresa</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-[var(--color-text-subtle)]">País</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-[var(--color-text-subtle)]">Origen</th>
                  <th className="text-left py-2 text-xs font-medium text-[var(--color-text-subtle)]">Fecha</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                <AnimatePresence initial={false}>
                  {attendees.map((a) => (
                    <motion.tr
                      key={a.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="group"
                    >
                      <td className="py-2.5 pr-4 font-medium text-[var(--color-text)]">
                        {a.firstName} {a.lastName}
                      </td>
                      <td className="py-2.5 pr-4 text-[var(--color-text-muted)]">
                        {a.email ? (
                          <a href={`mailto:${a.email}`} className="hover:text-[var(--color-primary)] transition-colors flex items-center gap-1">
                            <Mail size={11} />{a.email}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-[var(--color-text-muted)]">
                        {a.company ? (
                          <span className="flex items-center gap-1"><Building size={11} />{a.company}</span>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-[var(--color-text-muted)]">
                        {a.country ? (
                          <span className="flex items-center gap-1"><Flag size={11} />{a.country}</span>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge variant={a.source === 'webhook' ? 'info' : 'neutral'} size="sm">
                          {a.source === 'webhook' ? 'Webhook' : 'Manual'}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-xs text-[var(--color-text-subtle)]">
                        {formatDate(a.createdAt)}
                      </td>
                      {canManage && (
                        <td className="py-2.5 pl-2">
                          <button
                            onClick={() => setDeleteTarget(a)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--color-text-subtle)] hover:text-red-400 transition-all"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add attendee modal */}
      <Modal open={showAddAttendee} onClose={() => setShowAddAttendee(false)} title="Agregar Inscrito" size="sm">
        <form onSubmit={handleAddAttendee} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombre *" placeholder="Juan" {...afield('firstName')} />
            <Input label="Apellido *" placeholder="García" {...afield('lastName')} />
            <Input label="Email" type="email" placeholder="juan@empresa.com" leftIcon={<Mail size={14} />} {...afield('email')} />
            <Input label="Teléfono" placeholder="+54 11..." leftIcon={<Phone size={14} />} {...afield('phone')} />
            <Input label="Empresa" placeholder="Empresa SA" leftIcon={<Building size={14} />} {...afield('company')} />
            <Select
              label="País"
              options={COUNTRY_OPTIONS}
              value={attendeeForm.country}
              onChange={(e) => setAttendeeForm((f) => ({ ...f, country: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowAddAttendee(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Agregar</Button>
          </div>
        </form>
      </Modal>

      {/* Delete attendee confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar Inscrito" size="sm">
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          ¿Eliminar a <strong className="text-[var(--color-text)]">{deleteTarget?.firstName} {deleteTarget?.lastName}</strong>?
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button variant="danger" loading={deleting} onClick={handleDeleteAttendee}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  )
}
