'use client'

import { useState, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import {
  Users, Send, Save, Filter, ChevronDown, ChevronUp,
  Search, FileText, Building2, Info, MapPin, Tag,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { RichEditor, type RichEditorHandle } from '@/components/ui/rich-editor'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { ModalFooter } from '@/components/ui/modal'
import type { Client, ClientStatus, EmailTemplate, Empresa } from '@/types'
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

interface UnifiedContact {
  id:       string
  email:    string
  name:     string
  empresa:  string
  subtitle: string
  source:   'client' | 'directorio'
}

type Source = 'clients' | 'directorio' | 'empresas' | 'todos'

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
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set())
  const [sendNow,        setSendNow]        = useState(false)
  const [submitting,     setSubmitting]     = useState(false)
  const [showFilters,    setShowFilters]    = useState(false)
  const [statusFilter,   setStatusFilter]   = useState('')
  const [searchFilter,   setSearchFilter]   = useState('')
  const [activityFilter, setActivityFilter] = useState('')
  const [cityFilter,     setCityFilter]     = useState('')
  const [source,         setSource]         = useState<Source>('clients')

  const editorRef = useRef<RichEditorHandle>(null)

  const { data: templatesData } = useQuery<EmailTemplate[]>({
    queryKey: ['email-templates'],
    queryFn:  async () => (await (await fetch('/api/email-templates')).json()).data ?? [],
  })

  const { data: clientsData } = useQuery({
    queryKey: ['clients-all'],
    queryFn:  async () => ((await (await fetch('/api/clients?limit=1000')).json()).data ?? []) as Client[],
    enabled:  source === 'clients' || source === 'todos',
  })

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
    enabled: source === 'directorio' || source === 'todos' || source === 'empresas',
  })

  const { data: empresasData } = useQuery({
    queryKey: ['empresas-campaign-all'],
    queryFn:  async () => {
      const r = await fetch('/api/empresas?limit=1000')
      if (!r.ok) return []
      return ((await r.json()).data ?? []) as Empresa[]
    },
    enabled: source === 'empresas',
  })

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const templates = templatesData ?? []

  // ── Unified contact list for clients / directorio / todos ─────────────────
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
        const fullName = `${d.firstName} ${d.lastName}`.trim()
        const empName  = d.empresa?.name ?? d.companyRaw ?? ''
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

    const seen = new Set<string>()
    return list.filter(c => {
      const key = c.email.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key); return true
    })
  }, [clientsData, contactosData, source])

  const filteredContacts = useMemo(() => {
    return allContacts.filter(c => {
      if (statusFilter && c.source === 'client') {
        const client = (clientsData ?? []).find(cl => `c:${cl.id}` === c.id)
        if (client && client.status !== statusFilter) return false
      }
      if (searchFilter) {
        const q = searchFilter.toLowerCase()
        return (
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.empresa.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [allContacts, statusFilter, searchFilter, clientsData])

  // ── Empresa-level list ─────────────────────────────────────────────────────
  const filteredEmpresas = useMemo(() => {
    if (source !== 'empresas') return []
    return (empresasData ?? []).filter(e => {
      if (searchFilter   && !e.name.toLowerCase().includes(searchFilter.toLowerCase()))             return false
      if (activityFilter && !(e.activity ?? '').toLowerCase().includes(activityFilter.toLowerCase())) return false
      if (cityFilter     && !(e.city     ?? '').toLowerCase().includes(cityFilter.toLowerCase()))     return false
      return true
    })
  }, [empresasData, searchFilter, activityFilter, cityFilter, source])

  const contactsPerEmpresa = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of (contactosData ?? [])) {
      if (!c.email || !c.empresa?.id) continue
      map[c.empresa.id] = (map[c.empresa.id] ?? 0) + 1
    }
    return map
  }, [contactosData])

  const empresaRecipientCount = useMemo(() => {
    if (source !== 'empresas') return 0
    const emails = new Set<string>()
    for (const c of (contactosData ?? [])) {
      if (!c.email || !c.empresa?.id || !selectedIds.has(c.empresa.id)) continue
      emails.add(c.email.toLowerCase())
    }
    return emails.size
  }, [contactosData, selectedIds, source])

  // ── Selection ──────────────────────────────────────────────────────────────
  const filteredIds = source === 'empresas'
    ? filteredEmpresas.map(e => e.id)
    : filteredContacts.map(c => c.id)

  const allSelected  = filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id))
  const someSelected = filteredIds.some(id => selectedIds.has(id))

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(prev => { const n = new Set(prev); filteredIds.forEach(id => n.delete(id)); return n })
    } else {
      setSelectedIds(prev => new Set(Array.from(prev).concat(filteredIds)))
    }
  }

  const toggleItem = (id: string) => {
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

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of (clientsData ?? [])) counts[c.status] = (counts[c.status] ?? 0) + 1
    return counts
  }, [clientsData])

  const applyTemplate = (id: string) => {
    const t = templates.find(t => t.id === id)
    if (!t) return
    setValue('subject', t.subject)
    editorRef.current?.setHTML(t.body)
  }

  const switchSource = (s: Source) => {
    setSource(s)
    setSelectedIds(new Set())
    setStatusFilter('')
    setSearchFilter('')
    setActivityFilter('')
    setCityFilter('')
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = async (data: FormData) => {
    const body = editorRef.current?.getHTML() ?? ''
    if (body.replace(/<[^>]+>/g, '').trim().length < 10) { toast.error('El cuerpo del email es muy corto'); return }

    let recipients: Array<{ email: string; name: string; empresa: string }>

    if (source === 'empresas') {
      if (selectedIds.size === 0) { toast.error('Seleccioná al menos una empresa'); return }
      const raw = (contactosData ?? [])
        .filter(c => c.email && c.empresa?.id && selectedIds.has(c.empresa.id))
        .map(c => ({ email: c.email!, name: `${c.firstName} ${c.lastName}`.trim(), empresa: c.empresa?.name ?? '' }))
      const seen = new Set<string>()
      recipients = raw.filter(r => {
        const k = r.email.toLowerCase()
        if (seen.has(k)) return false
        seen.add(k); return true
      })
      if (recipients.length === 0) {
        toast.error('Las empresas seleccionadas no tienen contactos con email en el directorio')
        return
      }
    } else {
      if (selectedIds.size === 0) { toast.error('Seleccioná al menos un destinatario'); return }
      recipients = allContacts
        .filter(c => selectedIds.has(c.id))
        .map(c => ({ email: c.email, name: c.name, empresa: c.empresa }))
    }

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Nombre de la campaña" placeholder="Campaña Junio 2026" error={errors.name?.message} {...register('name')} />
        <Input label="Asunto del email"      placeholder="¡Tenemos novedades para vos!" error={errors.subject?.message} {...register('subject')} />
      </div>

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
            {source === 'empresas' && selectedIds.size > 0 ? (
              <span className="ml-2 font-semibold" style={{ color: 'var(--color-primary)' }}>
                {selectedIds.size} empresa{selectedIds.size !== 1 ? 's' : ''} · {empresaRecipientCount} email{empresaRecipientCount !== 1 ? 's' : ''}
              </span>
            ) : selectedIds.size > 0 ? (
              <span className="ml-2 font-semibold" style={{ color: 'var(--color-primary)' }}>
                {selectedIds.size} seleccionados
              </span>
            ) : null}
          </label>
          <button type="button" onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors">
            <Filter size={12} /> Filtrar
            {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Source tabs */}
        <div className="grid grid-cols-4 rounded-xl overflow-hidden border border-[var(--color-border)] p-0.5 bg-[var(--color-surface-raised)] mb-3">
          {([
            { key: 'clients',    label: 'Clientes',   icon: <Users size={11} /> },
            { key: 'empresas',   label: 'Empresas',   icon: <Building2 size={11} /> },
            { key: 'directorio', label: 'Directorio', icon: <Users size={11} /> },
            { key: 'todos',      label: 'Todos',      icon: null },
          ] as { key: Source; label: string; icon: React.ReactNode }[]).map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => switchSource(opt.key)}
              className={`flex items-center justify-center gap-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                source === opt.key ? 'gradient-bg text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {opt.icon}{opt.label}
            </button>
          ))}
        </div>

        {/* Quick status chips (clients only) */}
        {(source === 'clients' || source === 'todos') && Object.keys(statusCounts).length > 0 && (
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

        {/* Filters panel */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 mb-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--color-text-subtle)' }} />
              <input type="text"
                placeholder={source === 'empresas' ? 'Buscar empresa...' : 'Buscar por nombre, email...'}
                value={searchFilter} onChange={e => setSearchFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
              />
            </div>
            {source === 'empresas' && (
              <>
                <div className="relative min-w-[140px]">
                  <Tag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: 'var(--color-text-subtle)' }} />
                  <input type="text" placeholder="Actividad..."
                    value={activityFilter} onChange={e => setActivityFilter(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                    style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                  />
                </div>
                <div className="relative min-w-[140px]">
                  <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: 'var(--color-text-subtle)' }} />
                  <input type="text" placeholder="Ciudad..."
                    value={cityFilter} onChange={e => setCityFilter(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                    style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                  />
                </div>
              </>
            )}
            {(source === 'clients' || source === 'todos') && (
              <Select options={STATUS_OPTIONS} value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)} className="w-44" />
            )}
          </div>
        )}

        {/* List */}
        <div className="surface-raised rounded-xl max-h-56 overflow-y-auto divide-y divide-[var(--color-border)]">
          {/* Select all header */}
          <div className="flex items-center justify-between px-4 py-2 sticky top-0 z-10"
            style={{ background: 'var(--color-surface-overlay)' }}>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium"
              style={{ color: 'var(--color-text-muted)' }}>
              <input type="checkbox" checked={allSelected}
                ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                onChange={toggleAll}
                className="w-3.5 h-3.5 accent-[var(--color-primary)] rounded" />
              {allSelected
                ? `Deseleccionar ${source === 'empresas' ? 'empresas' : 'contactos'} filtrados`
                : `Seleccionar ${source === 'empresas' ? `las ${filteredEmpresas.length} empresas` : `los ${filteredContacts.length} contactos`} filtrados`
              }
            </label>
            {source === 'empresas' && filteredEmpresas.length !== (empresasData ?? []).length && (
              <span className="text-[10px]" style={{ color: 'var(--color-text-subtle)' }}>
                {filteredEmpresas.length} de {(empresasData ?? []).length}
              </span>
            )}
            {source !== 'empresas' && filteredContacts.length !== allContacts.length && (
              <span className="text-[10px]" style={{ color: 'var(--color-text-subtle)' }}>
                {filteredContacts.length} de {allContacts.length}
              </span>
            )}
          </div>

          {/* Empresas rows */}
          {source === 'empresas' ? (
            filteredEmpresas.length === 0 ? (
              <p className="p-4 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
                {(empresasData ?? []).length === 0 ? 'No hay empresas en el directorio' : 'Sin resultados para ese filtro'}
              </p>
            ) : (
              filteredEmpresas.map(empresa => {
                const emailCount = contactsPerEmpresa[empresa.id] ?? 0
                return (
                  <label key={empresa.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-surface-overlay)] cursor-pointer transition-colors">
                    <input type="checkbox" checked={selectedIds.has(empresa.id)}
                      onChange={() => toggleItem(empresa.id)}
                      className="w-3.5 h-3.5 accent-[var(--color-primary)] rounded shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                        {empresa.name}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {[empresa.activity, empresa.city].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                      emailCount > 0
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-[var(--color-surface)] text-[var(--color-text-subtle)]'
                    }`}>
                      {emailCount} email{emailCount !== 1 ? 's' : ''}
                    </span>
                  </label>
                )
              })
            )
          ) : (
            /* Contact rows */
            filteredContacts.length === 0 ? (
              <p className="p-4 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
                {allContacts.length === 0 ? 'No hay contactos en esta fuente' : 'Sin resultados para ese filtro'}
              </p>
            ) : (
              filteredContacts.map(contact => (
                <label key={contact.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-surface-overlay)] cursor-pointer transition-colors">
                  <input type="checkbox" checked={selectedIds.has(contact.id)}
                    onChange={() => toggleItem(contact.id)}
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
            )
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <Users size={13} style={{ color: 'var(--color-primary)' }} className="shrink-0" />
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {source === 'empresas' ? (
                <>
                  <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>{selectedIds.size}</span>
                  {' '}empresa{selectedIds.size !== 1 ? 's' : ''} →{' '}
                  <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>{empresaRecipientCount}</span>
                  {' '}destinatario{empresaRecipientCount !== 1 ? 's' : ''}
                </>
              ) : (
                <>
                  <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>{selectedIds.size}</span>
                  {' '}destinatario{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
                </>
              )}
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
