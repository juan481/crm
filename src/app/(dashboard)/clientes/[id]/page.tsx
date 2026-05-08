'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Edit, Trash2, Globe, Phone, Mail, MapPin, Building,
  DollarSign, Calendar, Tag, ExternalLink, MessageCircle, Plus, User,
  Key, Monitor, Package, RotateCcw, TrendingUp, ShieldCheck, Clock,
  CheckSquare, Square, AlertCircle, Flag,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { ClientForm } from '@/components/clients/client-form'
import { ActivityFeed } from '@/components/clients/activity-feed'
import { ContactsManager } from '@/components/clients/contacts-manager'
import { SalesTab } from '@/components/clients/sales-tab'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import {
  formatCurrency, formatDate, CLIENT_STATUS_LABELS, CLIENT_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
} from '@/lib/utils'
import { usePlugin } from '@/hooks/use-plugin'
import type { Client, Invoice, Task } from '@/types'
import toast from 'react-hot-toast'

type Tab = 'info' | 'licencia' | 'comercial' | 'contactos' | 'ventas' | 'facturas' | 'tareas'

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [addInvoiceOpen, setAddInvoiceOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('info')

  const { enabled: whatsappEnabled } = usePlugin('whatsapp-integration')

  const { data, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${id}`)
      if (!res.ok) throw new Error('Cliente no encontrado')
      const json = await res.json()
      return json.data as Client
    },
    staleTime: 30 * 1000,
  })

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Cliente eliminado')
        qc.invalidateQueries({ queryKey: ['clients'] })
        router.push('/clientes')
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
        <Skeleton className="h-8 w-48 rounded-xl" />
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
  const tags: string[] = Array.isArray(data.tags) ? data.tags : []
  const whatsappPhone = data.phone?.replace(/\D/g, '')

  const TABS: { key: Tab; label: string }[] = [
    { key: 'info', label: 'Información' },
    { key: 'licencia', label: 'Licencia' },
    { key: 'comercial', label: 'Comercial' },
    { key: 'contactos', label: 'Contactos' },
    { key: 'ventas', label: 'Ventas' },
    { key: 'tareas', label: 'Tareas' },
    { key: 'facturas', label: 'Facturas' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <button
          onClick={() => router.push('/clientes')}
          className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors w-fit"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Volver</span>
        </button>
        <div className="flex items-center gap-3 flex-1">
          <Avatar name={data.name} size="md" />
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text)]">{data.name}</h1>
            {data.company && <p className="text-sm text-[var(--color-text-muted)]">{data.company}</p>}
          </div>
          <Badge variant={CLIENT_STATUS_COLORS[data.status] as 'success' | 'warning' | 'danger' | 'info' | 'neutral'} className="ml-2" dot>
            {CLIENT_STATUS_LABELS[data.status]}
          </Badge>
          <Badge variant={data.clientType === 'B2B' ? 'info' : 'warning'} size="sm">{data.clientType}</Badge>
          {!data.isEnabled && <Badge variant="neutral" size="sm">Deshabilitado</Badge>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {whatsappEnabled && whatsappPhone && (
            <a href={`https://wa.me/${whatsappPhone}`} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm" leftIcon={<MessageCircle size={14} />}>WhatsApp</Button>
            </a>
          )}
          <Button variant="secondary" size="sm" leftIcon={<Edit size={14} />} onClick={() => setEditOpen(true)}>Editar</Button>
          <Button variant="danger" size="sm" leftIcon={<Trash2 size={14} />} onClick={() => setDeleteOpen(true)}>Eliminar</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto surface rounded-2xl p-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? 'gradient-bg text-white shadow-glow'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">

          {/* TAB: Información */}
          {activeTab === 'info' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Información de Contacto</CardTitle></CardHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { icon: <Mail size={15} />, label: 'Email', value: data.email, href: `mailto:${data.email}` },
                    { icon: <Phone size={15} />, label: 'Teléfono', value: data.phone },
                    { icon: <Building size={15} />, label: 'Empresa', value: data.company },
                    { icon: <MapPin size={15} />, label: 'Dirección', value: [data.address, data.city, data.province, data.country, data.postalCode].filter(Boolean).join(', ') || null },
                    { icon: <Globe size={15} />, label: 'Sitio web', value: data.website, href: data.website ?? undefined },
                  ].map((item) =>
                    item.value ? (
                      <div key={item.label} className="flex items-start gap-3">
                        <div className="mt-0.5 text-[var(--color-text-subtle)] shrink-0">{item.icon}</div>
                        <div>
                          <p className="text-xs text-[var(--color-text-subtle)] mb-0.5">{item.label}</p>
                          {item.href ? (
                            <a href={item.href} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--color-primary)] hover:underline flex items-center gap-1">
                              {item.value}<ExternalLink size={11} />
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

              <Card>
                <CardHeader><CardTitle>Servicio Contratado</CardTitle></CardHeader>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {data.serviceType && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full gradient-bg text-white text-sm font-medium">
                        <Tag size={13} />{data.serviceType}
                      </span>
                    )}
                    {tags.map((tag) => (
                      <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] border border-[var(--color-border)]">{tag}</span>
                    ))}
                    {!data.serviceType && tags.length === 0 && <p className="text-sm text-[var(--color-text-subtle)]">Sin servicio asignado</p>}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Costo mensual', value: formatCurrency(data.mrr), icon: <DollarSign size={11} /> },
                      { label: 'Costo anual est.', value: formatCurrency(data.mrr * 12), icon: <DollarSign size={11} /> },
                      { label: 'Inicio', value: data.contractStart ? formatDate(data.contractStart) : '—', icon: <Calendar size={11} /> },
                      { label: 'Vencimiento', value: data.contractEnd ? formatDate(data.contractEnd) : '—', icon: <Calendar size={11} /> },
                    ].map((stat) => (
                      <div key={stat.label} className="surface-raised rounded-xl p-3">
                        <p className="text-xs text-[var(--color-text-subtle)] mb-1 flex items-center gap-1">{stat.icon}{stat.label}</p>
                        <p className="text-sm font-bold text-[var(--color-text)]">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* TAB: Licencia */}
          {activeTab === 'licencia' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <CardHeader><CardTitle>Información de Licencia</CardTitle></CardHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Nro. Serie', value: data.licenseSerial, icon: <Key size={14} /> },
                    { label: 'Versión Venta', value: data.licenseVersion, icon: <Package size={14} /> },
                    { label: 'Máx. Workstations', value: data.maxWorkstations ? String(data.maxWorkstations) : null, icon: <Monitor size={14} /> },
                    { label: 'Inicio Suscripción', value: data.subscriptionStart ? formatDate(data.subscriptionStart) : null, icon: <Calendar size={14} /> },
                    { label: 'Vencimiento Suscripción', value: data.subscriptionEnd ? formatDate(data.subscriptionEnd) : null, icon: <Calendar size={14} /> },
                  ].map((item) =>
                    item.value ? (
                      <div key={item.label} className="flex items-start gap-3">
                        <div className="mt-0.5 text-[var(--color-text-subtle)] shrink-0">{item.icon}</div>
                        <div>
                          <p className="text-xs text-[var(--color-text-subtle)] mb-0.5">{item.label}</p>
                          <p className="text-sm text-[var(--color-text)]">{item.value}</p>
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Hibernar Licencia', value: data.licenseHibernated, icon: <Clock size={14} /> },
                    { label: 'Licencia Recomprada', value: data.licenseRepurchased, icon: <RotateCcw size={14} /> },
                    { label: 'Activo Full 24/7', value: data.isActive24x7, icon: <ShieldCheck size={14} /> },
                  ].map((flag) => (
                    <div key={flag.label} className={`flex items-center gap-2 p-3 rounded-xl border ${flag.value ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-[var(--color-border)] bg-[var(--color-surface-raised)]'}`}>
                      <span className={flag.value ? 'text-emerald-400' : 'text-[var(--color-text-subtle)]'}>{flag.icon}</span>
                      <span className="text-sm text-[var(--color-text)]">{flag.label}</span>
                      <Badge variant={flag.value ? 'success' : 'neutral'} size="sm" className="ml-auto">{flag.value ? 'Sí' : 'No'}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* TAB: Comercial */}
          {activeTab === 'comercial' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <CardHeader><CardTitle>Información Comercial</CardTitle></CardHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Distribuidor', value: data.distributorName, icon: <Building size={14} /> },
                    { label: 'Inversión Total', value: data.totalInvestment ? formatCurrency(data.totalInvestment) : null, icon: <DollarSign size={14} /> },
                    { label: 'Renovaciones', value: String(data.renewalCount), icon: <RotateCcw size={14} /> },
                    { label: 'Vendedor asignado', value: data.assignedSeller?.name ?? null, icon: <TrendingUp size={14} /> },
                  ].map((item) =>
                    item.value ? (
                      <div key={item.label} className="flex items-start gap-3">
                        <div className="mt-0.5 text-[var(--color-text-subtle)] shrink-0">{item.icon}</div>
                        <div>
                          <p className="text-xs text-[var(--color-text-subtle)] mb-0.5">{item.label}</p>
                          <p className="text-sm text-[var(--color-text)]">{item.value}</p>
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {/* TAB: Contactos */}
          {activeTab === 'contactos' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ContactsManager clientId={id} contacts={data.contacts ?? []} onUpdate={() => qc.invalidateQueries({ queryKey: ['client', id] })} />
            </motion.div>
          )}

          {/* TAB: Ventas */}
          {activeTab === 'ventas' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <SalesTab clientId={id} sales={data.sales ?? []} onUpdate={() => qc.invalidateQueries({ queryKey: ['client', id] })} />
            </motion.div>
          )}

          {/* TAB: Tareas */}
          {activeTab === 'tareas' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ClientTasksTab clientId={id} />
            </motion.div>
          )}

          {/* TAB: Facturas */}
          {activeTab === 'facturas' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Facturas</span>
                    <Button size="sm" variant="secondary" leftIcon={<Plus size={13} />} onClick={() => setAddInvoiceOpen(true)}>Nueva factura</Button>
                  </CardTitle>
                </CardHeader>
                {invoices.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-subtle)] text-center py-6">
                    Sin facturas.{' '}
                    <button onClick={() => setAddInvoiceOpen(true)} className="text-[var(--color-primary)] hover:underline">Crear primera</button>
                  </p>
                ) : (
                  <div className="space-y-2">
                    {invoices.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                        <div>
                          <p className="text-sm text-[var(--color-text)]">{inv.description ?? 'Servicio'}</p>
                          <p className="text-xs text-[var(--color-text-subtle)]">Vence: {formatDate(inv.dueDate)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-sm text-[var(--color-text)]">{formatCurrency(inv.amount, inv.currency)}</span>
                          <Badge variant={inv.status === 'PAID' ? 'success' : inv.status === 'OVERDUE' ? 'danger' : 'warning'} size="sm">
                            {INVOICE_STATUS_LABELS[inv.status]}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    <Link href="/facturas" className="text-xs text-[var(--color-primary)] hover:underline block text-center pt-2">Ver todas las facturas →</Link>
                  </div>
                )}
              </Card>
            </motion.div>
          )}
        </div>

        {/* Activity feed (always visible) */}
        <div>
          <Card className="sticky top-6">
            <CardHeader><CardTitle>Actividad</CardTitle></CardHeader>
            <ActivityFeed clientId={id} />
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

      <Modal open={addInvoiceOpen} onClose={() => setAddInvoiceOpen(false)} title="Nueva Factura" size="md">
        <InvoiceForm
          defaultClientId={id}
          onSuccess={() => { setAddInvoiceOpen(false); qc.invalidateQueries({ queryKey: ['client', id] }); toast.success('Factura creada') }}
          onCancel={() => setAddInvoiceOpen(false)}
        />
      </Modal>

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

const PRIORITY_COLORS_TASK: Record<string, string> = {
  BAJA: 'neutral', MEDIA: 'info', ALTA: 'warning', URGENTE: 'danger',
}

function ClientTasksTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', '', clientId],
    queryFn: async () => {
      const res = await fetch(`/api/tareas?clientId=${clientId}`)
      if (!res.ok) throw new Error('Error')
      return res.json().then(j => j.data)
    },
    staleTime: 30 * 1000,
  })

  const tasks = data ?? []

  const toggle = async (task: Task) => {
    const newStatus = task.status === 'HECHA' ? 'PENDIENTE' : 'HECHA'
    const res = await fetch(`/api/tareas/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) qc.invalidateQueries({ queryKey: ['tasks', '', clientId] })
    else toast.error('Error al actualizar')
  }

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="surface rounded-xl h-12 animate-pulse" />)}</div>

  if (tasks.length === 0) {
    return (
      <div className="surface rounded-2xl p-12 text-center">
        <CheckSquare className="mx-auto mb-2 text-[var(--color-text-subtle)]" size={32} />
        <p className="text-sm text-[var(--color-text-muted)]">No hay tareas para este cliente</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const overdue = !task.dueDate || task.status === 'HECHA' ? false : new Date(task.dueDate) < new Date()
        return (
          <div key={task.id} className={`surface rounded-xl px-4 py-3 flex items-start gap-3 ${task.status === 'HECHA' ? 'opacity-60' : ''}`}>
            <button
              onClick={() => toggle(task)}
              className={`mt-0.5 shrink-0 transition-colors ${task.status === 'HECHA' ? 'text-emerald-400' : 'text-[var(--color-text-subtle)] hover:text-[var(--color-primary)]'}`}
            >
              {task.status === 'HECHA' ? <CheckSquare size={16} /> : <Square size={16} />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-sm font-medium ${task.status === 'HECHA' ? 'line-through text-[var(--color-text-subtle)]' : 'text-[var(--color-text)]'}`}>
                  {task.title}
                </span>
                <Badge variant={PRIORITY_COLORS_TASK[task.priority] as 'neutral' | 'info' | 'warning' | 'danger'} size="sm">
                  {task.priority}
                </Badge>
                {overdue && <Badge variant="danger" size="sm" dot>Vencida</Badge>}
              </div>
              {task.description && <p className="text-xs text-[var(--color-text-subtle)] mt-0.5">{task.description}</p>}
              <div className="flex items-center gap-3 mt-1">
                {task.assignedTo && (
                  <span className="text-[10px] text-[var(--color-text-subtle)] flex items-center gap-1">
                    <User size={9} />{task.assignedTo.name}
                  </span>
                )}
                {task.dueDate && (
                  <span className={`text-[10px] flex items-center gap-1 ${overdue ? 'text-red-400' : 'text-[var(--color-text-subtle)]'}`}>
                    <Calendar size={9} />{formatDate(task.dueDate)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
