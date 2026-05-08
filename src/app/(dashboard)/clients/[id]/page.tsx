'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Edit, Trash2, Globe, Phone, Mail, MapPin, Building,
  DollarSign, Calendar, Tag, ExternalLink, MessageCircle, Plus, User,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { ClientForm } from '@/components/clients/client-form'
import { ClientTimeline } from '@/components/clients/client-timeline'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import {
  formatCurrency, formatDate, CLIENT_STATUS_LABELS, CLIENT_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
} from '@/lib/utils'
import { usePlugin } from '@/hooks/use-plugin'
import type { Client, Invoice, Note } from '@/types'
import toast from 'react-hot-toast'

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [addInvoiceOpen, setAddInvoiceOpen] = useState(false)

  const { enabled: whatsappEnabled } = usePlugin('whatsapp-integration')

  const { data, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${id}`)
      if (!res.ok) throw new Error('Cliente no encontrado')
      const json = await res.json()
      return json.data as Client
    },
    staleTime: 60 * 1000,
  })

  const notes: Note[] = data?.notes ?? []

  const handleNoteAdded = (note: Note) => {
    qc.setQueryData(['client', id], (old: Client | undefined) =>
      old ? { ...old, notes: [note, ...(old.notes ?? [])] } : old
    )
  }

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Cliente eliminado')
        router.push('/clients')
      } else {
        toast.error('Error al eliminar')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-8 h-8 rounded-xl" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!data) return null

  const invoices: Invoice[] = data.invoices ?? []
  const contacts = data.contacts ?? []
  const tags: string[] = Array.isArray(data.tags) ? data.tags : []

  const whatsappPhone = data.phone?.replace(/\D/g, '')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors w-fit"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Volver</span>
        </button>
        <div className="flex items-center gap-3 flex-1">
          <Avatar name={data.name} size="md" />
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text)]">{data.name}</h1>
            {data.company && (
              <p className="text-sm text-[var(--color-text-muted)]">{data.company}</p>
            )}
          </div>
          <Badge
            variant={CLIENT_STATUS_COLORS[data.status] as 'success' | 'warning' | 'danger' | 'info' | 'neutral'}
            className="ml-2"
            dot
          >
            {CLIENT_STATUS_LABELS[data.status]}
          </Badge>
        </div>
        <div className="flex gap-2 flex-wrap">
          {whatsappEnabled && whatsappPhone && (
            <a
              href={`https://wa.me/${whatsappPhone}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="secondary" size="sm" leftIcon={<MessageCircle size={14} />}>
                WhatsApp
              </Button>
            </a>
          )}
          <Button variant="secondary" size="sm" leftIcon={<Edit size={14} />} onClick={() => setEditOpen(true)}>
            Editar
          </Button>
          <Button variant="danger" size="sm" leftIcon={<Trash2 size={14} />} onClick={() => setDeleteOpen(true)}>
            Eliminar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4">

          {/* Contact info */}
          <Card>
            <CardHeader>
              <CardTitle>Información de Contacto</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: <Mail size={15} />, label: 'Email', value: data.email, href: `mailto:${data.email}` },
                { icon: <Phone size={15} />, label: 'Teléfono', value: data.phone },
                { icon: <Building size={15} />, label: 'Empresa', value: data.company },
                { icon: <MapPin size={15} />, label: 'Ubicación', value: [data.city, data.country].filter(Boolean).join(', ') || null },
                { icon: <Globe size={15} />, label: 'Sitio web', value: data.website, href: data.website ?? undefined },
              ].map((item) =>
                item.value ? (
                  <div key={item.label} className="flex items-start gap-3">
                    <div className="mt-0.5 text-[var(--color-text-subtle)] shrink-0">{item.icon}</div>
                    <div>
                      <p className="text-xs text-[var(--color-text-subtle)] mb-0.5">{item.label}</p>
                      {item.href ? (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[var(--color-primary)] hover:underline flex items-center gap-1"
                        >
                          {item.value}
                          <ExternalLink size={11} />
                        </a>
                      ) : (
                        <p className="text-sm text-[var(--color-text)]">{item.value}</p>
                      )}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          </Card>

          {/* Servicio Contratado */}
          <Card>
            <CardHeader>
              <CardTitle>Servicio Contratado</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              {/* Service type + tags */}
              <div className="flex flex-wrap items-center gap-2">
                {data.serviceType && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full gradient-bg text-white text-sm font-medium">
                    <Tag size={13} />
                    {data.serviceType}
                  </span>
                )}
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
                  >
                    {tag}
                  </span>
                ))}
                {!data.serviceType && tags.length === 0 && (
                  <p className="text-sm text-[var(--color-text-subtle)]">Sin servicio asignado</p>
                )}
              </div>

              {/* Financial grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="surface-raised rounded-xl p-3">
                  <p className="text-xs text-[var(--color-text-subtle)] mb-1 flex items-center gap-1">
                    <DollarSign size={11} /> Costo mensual
                  </p>
                  <p className="text-lg font-bold text-[var(--color-text)]">{formatCurrency(data.mrr)}</p>
                </div>
                <div className="surface-raised rounded-xl p-3">
                  <p className="text-xs text-[var(--color-text-subtle)] mb-1 flex items-center gap-1">
                    <DollarSign size={11} /> Costo anual est.
                  </p>
                  <p className="text-lg font-bold text-[var(--color-text)]">{formatCurrency(data.mrr * 12)}</p>
                </div>
                <div className="surface-raised rounded-xl p-3">
                  <p className="text-xs text-[var(--color-text-subtle)] mb-1 flex items-center gap-1">
                    <Calendar size={11} /> Inicio
                  </p>
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    {data.contractStart ? formatDate(data.contractStart) : '—'}
                  </p>
                </div>
                <div className="surface-raised rounded-xl p-3">
                  <p className="text-xs text-[var(--color-text-subtle)] mb-1 flex items-center gap-1">
                    <Calendar size={11} /> Vencimiento
                  </p>
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    {data.contractEnd ? formatDate(data.contractEnd) : '—'}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Contacts */}
          {contacts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Contactos</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                {contacts.map((contact) => (
                  <div key={contact.id} className="flex items-center gap-3 py-2 border-b border-[var(--color-border)] last:border-0">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-surface-raised)] flex items-center justify-center shrink-0">
                      <User size={14} className="text-[var(--color-text-subtle)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text)]">{contact.name}</p>
                      {contact.role && <p className="text-xs text-[var(--color-text-subtle)]">{contact.role}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="text-xs text-[var(--color-primary)] hover:underline">
                          {contact.email}
                        </a>
                      )}
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="text-xs text-[var(--color-text-muted)]">
                          {contact.phone}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Invoices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Facturas</span>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Plus size={13} />}
                  onClick={() => setAddInvoiceOpen(true)}
                >
                  Nueva factura
                </Button>
              </CardTitle>
            </CardHeader>
            {invoices.length === 0 ? (
              <p className="text-sm text-[var(--color-text-subtle)] text-center py-6">
                Sin facturas registradas.{' '}
                <button onClick={() => setAddInvoiceOpen(true)} className="text-[var(--color-primary)] hover:underline">
                  Crear primera factura
                </button>
              </p>
            ) : (
              <div className="space-y-2">
                {invoices.slice(0, 6).map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                    <div>
                      <p className="text-sm text-[var(--color-text)]">{inv.description ?? 'Servicio'}</p>
                      <p className="text-xs text-[var(--color-text-subtle)]">Vence: {formatDate(inv.dueDate)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm text-[var(--color-text)]">
                        {formatCurrency(inv.amount, inv.currency)}
                      </span>
                      <Badge variant={inv.status === 'PAID' ? 'success' : inv.status === 'OVERDUE' ? 'danger' : 'warning'} size="sm">
                        {INVOICE_STATUS_LABELS[inv.status]}
                      </Badge>
                    </div>
                  </div>
                ))}
                {invoices.length > 6 && (
                  <Link href="/invoices" className="text-xs text-[var(--color-primary)] hover:underline block text-center pt-2">
                    Ver todas las facturas →
                  </Link>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Timeline */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Actividad</CardTitle>
            </CardHeader>
            <ClientTimeline
              clientId={id}
              notes={notes}
              onNoteAdded={handleNoteAdded}
            />
          </Card>
        </div>
      </div>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar Cliente" size="lg">
        <ClientForm
          client={data}
          onSuccess={(updated) => {
            setEditOpen(false)
            qc.setQueryData(['client', id], (old: Client) => ({ ...old, ...updated }))
            toast.success('Cliente actualizado')
          }}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>

      {/* Add Invoice modal */}
      <Modal open={addInvoiceOpen} onClose={() => setAddInvoiceOpen(false)} title="Nueva Factura" size="md">
        <InvoiceForm
          defaultClientId={id}
          onSuccess={() => {
            setAddInvoiceOpen(false)
            qc.invalidateQueries({ queryKey: ['client', id] })
            toast.success('Factura creada')
          }}
          onCancel={() => setAddInvoiceOpen(false)}
        />
      </Modal>

      {/* Delete confirm */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Eliminar Cliente" size="sm">
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          ¿Estás seguro de eliminar a <strong className="text-[var(--color-text)]">{data.name}</strong>? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  )
}
