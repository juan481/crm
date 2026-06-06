'use client'

import { useState, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import {
  Users, Send, Save, Filter, ChevronDown, ChevronUp,
  Search, FileText, Building2, Info,
} from 'lucide-react'
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
  onCancel:  () => void
}

// Unified contact type used internally regardless of source
interface UnifiedContact {
  id:       string
  email:    string
  name:     string
  empresa:  string   // used for {{empresa}} personalisation
  subtitle: string   // shown in the UI list
  source:   'client' | 'directorio'
}

type Source = 'clients' | 'directorio' | 'todos'

const STATUS_OPTIONS = [
  { value: '',                 label: 'Todos los estados'  },
  { value: 'ACTIVE',          label: CLIENT_STATUS_LABELS.ACTIVE          },
  { value: 'PROSPECT',        label: CLIENT_STATUS_LABELS.PROSPECT        },
  { value: 'PENDING_PAYMENT', label: CLIENT_STATUS_LABELS.PENDING_PAYMENT },
  { value: 'INACTIVE',        label: CLIENT_STATUS_LABELS.INACTIVE        },
  { value: 'EXPIRED',         label: CLIENT_STATUS_LABELS.EXPIRED         },
]

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  ACTIVE:          'success',
  PROSPECT:        'info',
  PENDING_PAYMENT: 'warning',
  INACTIVE:        'neutral',
  EXPIRED:         'danger',
}

export function CampaignComposer({ onSuccess, onCancel }: CampaignComposerProps) {
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set())
  const [sendNow,       setSendNow]       = useState(false)
  const [submitting,    setSubmitting]    = useState(false)
  const [showFilters,   setShowFilters]   = useState(false)
  const [statusFilter,  setStatusFilter]  = useState('')
  const [searchFilter,  setSearchFilter]  = useState('')
  const [source,        setSource]        = useState<Source>('clients')

  const editorRef = useRef<RichEditorHandle>(null)

  // ── Templates ──────────────────────────────────────────────────────────────
  const { data: templatesData } = useQuery<EmailTemplate[]>({
    queryKey: ['email-templates'],
    queryFn:  async () => (await (await fetch('/api/email-templates')).json()).data ?? [],
  })

  // ── Clients ────────────────────────────────────────────────────────────────
  const { data: clientsData } = useQuery({
    queryKey: ['clients-all'],
    queryFn:  async () => ((await (await fetch('/api/clients?limit=1000')).json()).data ?? []) as Client[],
    enabled:  source === 'clients' || source === 'todos',
  })

  // ── Directorio contacts ────────────────────────────────────────────────────
  const { data: contactosData } = useQuery({
    queryKey: ['directorio-all'],
    queryFn:  async () => {
      const r = await fetch('/api/contactos?limit=1000')
      if (!r.ok) return []
      return ((await r.json()).data ?? []) as Array<{
        id: string; firstName: string; lastName: string
        email: string | null
        empresa?: { id: string; name: string } | null
        companyRaw?: string | null
      }>
    },
    enabled: source === 'directorio' || source === 'todos',
  })

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const templates = templatesData ?? []

  // ── Build unified list ─────────────────────────────────────────────────────
  const allContacts = useMemo<UnifiedContact[]>(() => {
    const list: UnifiedContact[] = []

    if (source === 'clients' || source === 'todos') {
      for (const c of (clientsData ?? [])) {
        if (!c.email) continue
        list.push({
          id:       `c:${c.id}`,
          email:    c.email,
          name:     c.name,
          empresa:  c.company ?? '',
          subtitle: [c.email, c.company].filter(Boolean).join(' · '),
          source:   'client',
        })
      }
    }

    if (source === 'directorio' || source === 'todos') {
      for (const d of (contactosData ?? [])) {
        if (!d.email) continue
        const fullName  = `${d.firstName} ${d.lastName}`.trim()
        const empName   = d.empresa?.name ?? d.companyRaw ?? ''
        list.push({
          id:       `d:${d.id}`,
          email:    d.email,
          name:     fullName,
          empresa:  empName,
          subtitle: [d.email, empName].filter(Boolean).join(' · '),
          source:   'directorio',
        })
      }
    }

    // Deduplicate by email (keep first occurrence)
    const seen = new Set<string>()
    return list.filter(c => {
      const key = c.email.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key); return true
    })
  }, [clientsData, contactosData, source])

  // ── Filters ────────────────────────────────────────────────────────────────
  const filteredContacts = useMemo(() => {
    return allContacts.filter(c => {
      // Status filter only applies to clients
      if (statusFilter && c.source === 'client') {
        const client = (clientsData ?? []).find(cl => `c:${cl.id}` === c.id)
        if (client && client.status !== statusFilter) return false
      }
      if (searchFilter) {
        const q = searchFilter.toLowerCase()
        return (
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.empresa.toLowerCase().includes(q) ||
          c.subtitle.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [allContacts, statusFilter, searchFilter, clientsData])

  const allSelected  = filteredContacts.length > 0 && filteredContacts.every(c => selectedIds.has(c.id))
  const someSelected = filteredContacts.some(c => selectedIds.has(c.id))

  // Status counts (clients only)
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of (clientsData ?? [])) counts[c.status] = (counts[c.status] ?? 0) + 1
    return counts
  }, [clientsData])

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(prev => { const n = new Set(prev); filteredContacts.forEach(c => n.delete(c.id)); return n })
    } else {
      setSelectedIds(prev => new Set(Array.from(prev).concat(filteredContacts.map(c => c.id))))
    }
  }

  const toggleContact = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const selectByStatus = (status: ClientStatus) => {
    const ids = allContacts.filter(c => {
      if (c.source !== 'client') return false
      const client = (clientsData ?? []).find(cl => `c:${cl.id}` === c.id)
      return client?.status === status
    }).map(c => c.id)
    setSelectedIds(prev => new Set(Array.from(prev).concat(ids)))
  }

  const applyTemplate = (id: string) => {
    const t = templates.find(t => t.id === id)
    if (!t) return
    setValue('subject', t.subject)
    editorRef.current?.setHTML(t.body)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = async (data: FormData) => {
    if (selectedIds.size === 0) { toast.error('Seleccioná al menos un destinatario'); return }
    const body = editorRef.current?.getHTML() ?? ''
    if (body.replace(/<[^>]+>/g, '').trim().length < 10) { toast.error('El cuerpo del email es muy corto'); return }

    // Resolve selected IDs to full recipient objects (email + name + empresa)
    const recipients = allContacts
      .filter(c => selectedIds.has(c.id))
      .map(c => ({ email: c.email, name: c.name, empresa: c.empresa }))

    setSubmitting(true)
    try {
      const res = await fetch('/api/communications/campaigns', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...data, body, recipients, sendNow }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success(sendNow ? `Enviando campaña a ${recipients.length} destinatarios…` : 'Campaña guardada como borrador')
      onSuccess()
    } catch {
      toast.error('Error al crear campaña')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
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
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {/* Campaign name + subject */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Nombre de la campaña" placeholder="Campaña Junio 2026" error={errors.name?.message} {...register('name')} />
        <Input label="Asunto del email"      placeholder="¡Tenemos novedades para vos!" error={errors.subject?.message} {...register('subject')} />
      </div>

      {/* Body editor */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-[var(--color-text-muted)]">Cuerpo del email</label>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
            style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
            <Info size={11} />
            Variables: <code className="font-mono">{'{{nombre}}'}</code> · <code className="font-mono">{'{{empresa}}'}</code> · <code className="font-mono">{'{{email}}'}</code>
          </div>
        </div>
        <RichEditor ref={editorRef} placeholder="Hola {{nombre}}, te escribimos desde…" minHeight={200} />
      </div>

      {/* ── Recipient section ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <label className="text-sm font-medium text-[var(--color-text-muted)]">
            Destinatarios
            {selectedIds.size > 0 && (
              <span className="ml-2 font-semibold" style={{ color: 'var(--color-primary)' }}>
                {selectedIds.size} seleccionados
              </span>
            )}
          </label>
          <button type="button" onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors">
            <Filter size={12} /> Segmentar
            {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Source toggle */}
        <div className="flex rounded-xl overflow-hidden border border-[var(--color-border)] p-0.5 bg-[var(--color-surface-raised)] mb-3">
          {([
            { key: 'clients',   label: 'Clientes CRM', icon: <Users size={12} /> },
            { key: 'directorio',label: 'Directorio',   icon: <Building2 size={12} /> },
            { key: 'todos',     label: 'Todos',        icon: null },
          ] as { key: Source; label: string; icon: React.ReactNode }[]).map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => { setSource(opt.key); setSelectedIds(new Set()); setStatusFilter('') }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                source === opt.key ? 'gradient-bg text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {opt.icon}{opt.label}
            </button>
          ))}
        </div>

        {/* Quick segment chips (clients only) */}
        {(source === 'clients' || source === 'todos') && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {Object.entries(statusCounts).map(([status, count]) => (
              <button key={status} type="button" onClick={() => selectByStatus(status as ClientStatus)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full border transition-all text-xs font-medium"
                style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  status === 'ACTIVE'          ? 'bg-emerald-400' :
                  status === 'PROSPECT'        ? 'bg-blue-400'    :
                  status === 'PENDING_PAYMENT' ? 'bg-amber-400'   :
                  status === 'EXPIRED'         ? 'bg-red-400'     : 'bg-slate-400'
                }`} />
                {CLIENT_STATUS_LABELS[status] ?? status}
                <span style={{ color: 'var(--color-text-subtle)' }}>({count})</span>
              </button>
            ))}
          </div>
        )}

        {/* Expandable filters */}
        {showFilters && (
          <div className="flex gap-2 mb-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--color-text-subtle)' }} />
              <input type="text" placeholder="Buscar por nombre, email o empresa..."
                value={searchFilter} onChange={e => setSearchFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
              />
            </div>
            {(source === 'clients' || source === 'todos') && (
              <Select options={STATUS_OPTIONS} value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)} className="w-44" />
            )}
          </div>
        )}

        {/* Contact list */}
        <div className="surface-raised rounded-xl max-h-56 overflow-y-auto divide-y divide-[var(--color-border)]">
          {/* Select all */}
          <div className="flex items-center justify-between px-4 py-2 sticky top-0 z-10"
            style={{ background: 'var(--color-surface-overlay)' }}>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium"
              style={{ color: 'var(--color-text-muted)' }}>
              <input type="checkbox" checked={allSelected}
                ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                onChange={toggleAll}
                className="w-3.5 h-3.5 accent-[var(--color-primary)] rounded" />
              {allSelected ? 'Deseleccionar todo' : `Seleccionar los ${filteredContacts.length} filtrados`}
            </label>
            {filteredContacts.length !== allContacts.length && (
              <span className="text-[10px]" style={{ color: 'var(--color-text-subtle)' }}>
                {filteredContacts.length} de {allContacts.length}
              </span>
            )}
          </div>

          {filteredContacts.length === 0 ? (
            <p className="p-4 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
              {allContacts.length === 0 ? 'No hay contactos en esta fuente' : 'Sin resultados para ese filtro'}
            </p>
          ) : (
            filteredContacts.map(contact => (
              <label key={contact.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-surface-overlay)] cursor-pointer transition-colors">
                <input type="checkbox" checked={selectedIds.has(contact.id)}
                  onChange={() => toggleContact(contact.id)}
                  className="w-3.5 h-3.5 accent-[var(--color-primary)] rounded shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                      {contact.name}
                    </p>
                    {contact.source === 'directorio' ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--color-primary)' }}>
                        Directorio
                      </span>
                    ) : (
                      (() => {
                        const client = (clientsData ?? []).find(c => `c:${c.id}` === contact.id)
                        return client ? (
                          <Badge variant={STATUS_BADGE[client.status] ?? 'neutral'} size="sm">
                            {CLIENT_STATUS_LABELS[client.status] ?? client.status}
                          </Badge>
                        ) : null
                      })()
                    )}
                  </div>
                  <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {contact.subtitle}
                  </p>
                </div>
              </label>
            ))
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <Users size={13} style={{ color: 'var(--color-primary)' }} className="shrink-0" />
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>{selectedIds.size}</span>
              {' '}destinatario{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </p>
            <button type="button" onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-xs hover:text-red-400 transition-colors"
              style={{ color: 'var(--color-text-subtle)' }}>
              Limpiar
            </button>
          </div>
        )}
      </div>

      <ModalFooter className="flex-col sm:flex-row items-start sm:items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer mr-auto">
          <input type="checkbox" checked={sendNow} onChange={e => setSendNow(e.target.checked)}
            className="w-4 h-4 accent-[var(--color-primary)] rounded" />
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Enviar ahora</span>
        </label>
        <Button variant="ghost" onClick={onCancel} type="button">Cancelar</Button>
        <Button type="submit" loading={submitting} leftIcon={sendNow ? <Send size={15} /> : <Save size={15} />}>
          {sendNow ? 'Enviar Campaña' : 'Guardar Borrador'}
        </Button>
      </ModalFooter>
    </form>
  )
}
