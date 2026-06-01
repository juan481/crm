'use client'

import { useState, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { Users, Send, Save, Filter, ChevronDown, ChevronUp, Search, FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { RichEditor, type RichEditorHandle } from '@/components/ui/rich-editor'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { ModalFooter } from '@/components/ui/modal'
import type { Client, ClientStatus, EmailTemplate } from '@/types'
import { CLIENT_STATUS_LABELS } from '@/lib/utils'
import toast from 'react-hot-toast'

const schema = z.object({
  name:    z.string().min(2, 'Nombre requerido'),
  subject: z.string().min(3, 'Asunto requerido'),
})
type FormData = z.infer<typeof schema>

interface CampaignComposerProps {
  onSuccess: () => void
  onCancel: () => void
}

const STATUS_OPTIONS = [
  { value: '',                label: 'Todos los estados' },
  { value: 'ACTIVE',         label: CLIENT_STATUS_LABELS.ACTIVE },
  { value: 'PROSPECT',       label: CLIENT_STATUS_LABELS.PROSPECT },
  { value: 'PENDING_PAYMENT',label: CLIENT_STATUS_LABELS.PENDING_PAYMENT },
  { value: 'INACTIVE',       label: CLIENT_STATUS_LABELS.INACTIVE },
  { value: 'EXPIRED',        label: CLIENT_STATUS_LABELS.EXPIRED },
]

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  ACTIVE:          'success',
  PROSPECT:        'info',
  PENDING_PAYMENT: 'warning',
  INACTIVE:        'neutral',
  EXPIRED:         'danger',
}

export function CampaignComposer({ onSuccess, onCancel }: CampaignComposerProps) {
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [sendNow, setSendNow]           = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [showFilters, setShowFilters]   = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchFilter, setSearchFilter] = useState('')

  const editorRef = useRef<RichEditorHandle>(null)

  const { data: templatesData } = useQuery<EmailTemplate[]>({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const res = await fetch('/api/email-templates')
      const json = await res.json()
      return json.data ?? []
    },
  })

  const { data: clientsData } = useQuery({
    queryKey: ['clients-all'],
    queryFn: async () => {
      const res = await fetch('/api/clients?limit=1000')
      const json = await res.json()
      return json.data as Client[]
    },
  })

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const allClients = clientsData ?? []
  const templates  = templatesData ?? []

  const applyTemplate = (id: string) => {
    const t = templates.find(t => t.id === id)
    if (!t) return
    setValue('subject', t.subject)
    editorRef.current?.setHTML(t.body)
  }

  // Apply filters
  const filteredClients = useMemo(() => {
    return allClients.filter(c => {
      if (statusFilter && c.status !== statusFilter) return false
      if (searchFilter) {
        const q = searchFilter.toLowerCase()
        return (
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.company ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [allClients, statusFilter, searchFilter])

  const allSelected  = filteredClients.length > 0 && filteredClients.every(c => selectedIds.has(c.id))
  const someSelected = filteredClients.some(c => selectedIds.has(c.id))

  // Count by status for quick stats
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    allClients.forEach(c => { counts[c.status] = (counts[c.status] ?? 0) + 1 })
    return counts
  }, [allClients])

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filteredClients.forEach(c => next.delete(c.id))
        return next
      })
    } else {
      setSelectedIds(prev => new Set(Array.from(prev).concat(filteredClients.map(c => c.id))))
    }
  }

  const toggleClient = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectByStatus = (status: ClientStatus) => {
    const ids = allClients.filter(c => c.status === status).map(c => c.id)
    setSelectedIds(prev => new Set(Array.from(prev).concat(ids)))
  }

  const onSubmit = async (data: FormData) => {
    if (selectedIds.size === 0) {
      toast.error('Seleccioná al menos un destinatario')
      return
    }
    const body = editorRef.current?.getHTML() ?? ''
    if (body.replace(/<[^>]+>/g, '').trim().length < 10) {
      toast.error('El cuerpo del email es muy corto')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/communications/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          body,
          recipientIds: Array.from(selectedIds),
          sendNow,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success(sendNow ? 'Campaña enviada exitosamente' : 'Campaña guardada como borrador')
      onSuccess()
    } catch {
      toast.error('Error al crear campaña')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Template selector */}
      {templates.length > 0 && (
        <div className="flex items-center gap-3 p-3 surface-raised rounded-xl">
          <FileText size={15} className="text-[var(--color-primary)] shrink-0" />
          <p className="text-xs text-[var(--color-text-muted)] mr-auto">Usar plantilla</p>
          <select
            onChange={e => applyTemplate(e.target.value)}
            className="text-sm text-[var(--color-text)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 cursor-pointer"
            defaultValue=""
          >
            <option value="" disabled>Seleccionar plantilla...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Campaign name + subject */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Nombre de la campaña"
          placeholder="Campaña Mayo 2026"
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="Asunto del email"
          placeholder="¡Tenemos novedades para vos!"
          error={errors.subject?.message}
          {...register('subject')}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[var(--color-text-muted)]">Cuerpo del email</label>
        <RichEditor
          ref={editorRef}
          placeholder="Escribí el contenido del email. Usá la barra de herramientas para dar formato..."
          minHeight={200}
        />
      </div>

      {/* Recipient selector */}
      <div>
        {/* Header row */}
        <div className="flex items-center justify-between mb-2.5">
          <label className="text-sm font-medium text-[var(--color-text-muted)]">
            Destinatarios
            {selectedIds.size > 0 && (
              <span className="ml-2 text-[var(--color-primary)] font-semibold">{selectedIds.size} seleccionados</span>
            )}
          </label>
          <button
            type="button"
            onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            <Filter size={12} />
            Segmentar
            {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Quick segment chips */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
              type="button"
              onClick={() => selectByStatus(status as ClientStatus)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-raised)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 transition-all text-xs font-medium text-[var(--color-text-muted)]"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                status === 'ACTIVE'          ? 'bg-emerald-400' :
                status === 'PROSPECT'        ? 'bg-blue-400'    :
                status === 'PENDING_PAYMENT' ? 'bg-amber-400'   :
                status === 'EXPIRED'         ? 'bg-red-400'     : 'bg-slate-400'
              }`} />
              {CLIENT_STATUS_LABELS[status] ?? status}
              <span className="text-[var(--color-text-subtle)]">({count})</span>
            </button>
          ))}
        </div>

        {/* Expandable filters */}
        {showFilters && (
          <div className="flex gap-2 mb-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)] pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por nombre, email o empresa..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
              />
            </div>
            <Select
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-44"
            />
          </div>
        )}

        {/* Client list */}
        <div className="surface-raised rounded-xl max-h-52 overflow-y-auto divide-y divide-[var(--color-border)]">
          {/* Select all row */}
          <div className="flex items-center justify-between px-4 py-2 bg-[var(--color-surface-overlay)] sticky top-0">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[var(--color-text-muted)]">
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                onChange={toggleAll}
                className="w-3.5 h-3.5 accent-[var(--color-primary)] rounded"
              />
              {allSelected ? 'Deseleccionar todo' : `Seleccionar los ${filteredClients.length} filtrados`}
            </label>
            {filteredClients.length !== allClients.length && (
              <span className="text-[10px] text-[var(--color-text-subtle)]">
                Mostrando {filteredClients.length} de {allClients.length}
              </span>
            )}
          </div>

          {filteredClients.length === 0 ? (
            <p className="p-4 text-sm text-[var(--color-text-muted)] text-center">
              {allClients.length === 0 ? 'No hay clientes' : 'Sin resultados para ese filtro'}
            </p>
          ) : (
            filteredClients.map((client) => (
              <label
                key={client.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-surface-overlay)] cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(client.id)}
                  onChange={() => toggleClient(client.id)}
                  className="w-3.5 h-3.5 accent-[var(--color-primary)] rounded shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">{client.name}</p>
                    <Badge variant={STATUS_BADGE[client.status] ?? 'neutral'} size="sm">
                      {CLIENT_STATUS_LABELS[client.status] ?? client.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] truncate">
                    {client.email}{client.company ? ` · ${client.company}` : ''}
                  </p>
                </div>
              </label>
            ))
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <Users size={13} className="text-[var(--color-primary)] shrink-0" />
            <p className="text-xs text-[var(--color-text-muted)]">
              <span className="font-semibold text-[var(--color-primary)]">{selectedIds.size}</span> destinatario{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </p>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-xs text-[var(--color-text-subtle)] hover:text-red-400 transition-colors"
            >
              Limpiar
            </button>
          </div>
        )}
      </div>

      <ModalFooter className="flex-col sm:flex-row items-start sm:items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer mr-auto">
          <input
            type="checkbox"
            checked={sendNow}
            onChange={e => setSendNow(e.target.checked)}
            className="w-4 h-4 accent-[var(--color-primary)] rounded"
          />
          <span className="text-sm text-[var(--color-text-muted)]">Enviar ahora</span>
        </label>
        <Button variant="ghost" onClick={onCancel} type="button">Cancelar</Button>
        <Button
          type="submit"
          loading={submitting}
          leftIcon={sendNow ? <Send size={15} /> : <Save size={15} />}
        >
          {sendNow ? 'Enviar Campaña' : 'Guardar Borrador'}
        </Button>
      </ModalFooter>
    </form>
  )
}
