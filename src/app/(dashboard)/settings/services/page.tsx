'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Tag, Edit, Trash2, Users, RefreshCw } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import toast from 'react-hot-toast'

const BILLING_LABELS: Record<string, string> = {
  MONTHLY: 'Mensual',
  QUARTERLY: 'Trimestral',
  ANNUAL: 'Anual',
  ONE_TIME: 'Único',
}

const BILLING_OPTIONS = Object.entries(BILLING_LABELS).map(([value, label]) => ({ value, label }))

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'ARS', label: 'ARS' },
  { value: 'EUR', label: 'EUR' },
  { value: 'MXN', label: 'MXN' },
  { value: 'CLP', label: 'CLP' },
  { value: 'COP', label: 'COP' },
  { value: 'UYU', label: 'UYU' },
  { value: 'BRL', label: 'BRL' },
]

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Debe ser mayor o igual a 0'),
  currency: z.string().default('USD'),
  billingCycle: z.string().default('MONTHLY'),
})
type FormData = z.infer<typeof schema>

interface Service {
  id: string
  name: string
  description: string | null
  price: number
  currency: string
  billingCycle: string
  _count: { clients: number }
}

function ServiceForm({ service, onSuccess, onCancel }: { service?: Service; onSuccess: () => void; onCancel: () => void }) {
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: service?.name ?? '',
      description: service?.description ?? '',
      price: service?.price ?? 0,
      currency: service?.currency ?? 'USD',
      billingCycle: service?.billingCycle ?? 'MONTHLY',
    },
  })

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      const url = service ? `/api/services/${service.id}` : '/api/services'
      const method = service ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success(service ? 'Servicio actualizado' : 'Servicio creado')
      onSuccess()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Nombre del servicio" placeholder="SEO + Google Ads" error={errors.name?.message} {...register('name')} />
      <Input label="Descripción (opcional)" placeholder="Posicionamiento + campañas de búsqueda" {...register('description')} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Precio" type="number" step="0.01" placeholder="0" error={errors.price?.message} {...register('price')} />
        <Select label="Moneda" options={CURRENCY_OPTIONS} {...register('currency')} />
      </div>
      <Select label="Ciclo de facturación" options={BILLING_OPTIONS} {...register('billingCycle')} />
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={saving}>{service ? 'Guardar cambios' : 'Crear servicio'}</Button>
      </div>
    </form>
  )
}

export default function ServicesPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editService, setEditService] = useState<Service | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'

  const { data, isLoading } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await fetch('/api/services')
      if (!res.ok) return []
      const json = await res.json()
      return json.data ?? []
    },
    staleTime: 60 * 1000,
  })

  const services = data ?? []

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/services/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Servicio eliminado')
      qc.invalidateQueries({ queryKey: ['services'] })
      setDeleteId(null)
    } catch {
      toast.error('Error al eliminar')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
            <Tag size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Catálogo de Servicios</h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Definí los servicios que ofrecés y asignalos a clientes
            </p>
          </div>
        </div>
        {canManage && (
          <Button leftIcon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            Nuevo Servicio
          </Button>
        )}
      </div>

      {/* Info panel */}
      <div className="surface rounded-2xl p-4 border-l-4 border-[var(--color-primary)] bg-[var(--color-primary-light)]">
        <p className="text-sm text-[var(--color-primary)]">
          <strong>¿Para qué sirven los servicios?</strong> Una vez que creás un servicio y lo asignás a un cliente,
          podés generar automáticamente las facturas mensuales desde <strong>Facturación → Generar Facturas del Mes</strong>.
          El precio del servicio se usa como monto de la factura.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : services.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface-raised)] flex items-center justify-center">
            <Tag size={24} className="text-[var(--color-text-subtle)]" />
          </div>
          <div>
            <p className="font-semibold text-[var(--color-text)] mb-1">Sin servicios creados</p>
            <p className="text-sm text-[var(--color-text-muted)] max-w-sm">
              Creá tu primer servicio para poder asignarlo a clientes y generar facturas recurrentes.
            </p>
          </div>
          {canManage && (
            <Button leftIcon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
              Crear primer servicio
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service, i) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="h-full flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
                    <Tag size={18} className="text-white" />
                  </div>
                  <Badge variant="info" size="sm">
                    <RefreshCw size={10} className="mr-1" />
                    {BILLING_LABELS[service.billingCycle]}
                  </Badge>
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-[var(--color-text)] mb-1">{service.name}</h3>
                  {service.description && (
                    <p className="text-sm text-[var(--color-text-muted)]">{service.description}</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xl font-bold text-[var(--color-text)]">
                    {formatCurrency(service.price, service.currency)}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                    <Users size={12} />
                    {service._count.clients} cliente{service._count.clients !== 1 ? 's' : ''}
                  </div>
                </div>

                {canManage && (
                  <div className="flex gap-2 pt-2 border-t border-[var(--color-border)]">
                    <button
                      onClick={() => setEditService(service)}
                      className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                    >
                      <Edit size={12} /> Editar
                    </button>
                    <button
                      onClick={() => setDeleteId(service.id)}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors ml-auto"
                    >
                      <Trash2 size={12} /> Eliminar
                    </button>
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo Servicio" size="sm">
        <ServiceForm
          onSuccess={() => { setCreateOpen(false); qc.invalidateQueries({ queryKey: ['services'] }) }}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      <Modal open={!!editService} onClose={() => setEditService(null)} title="Editar Servicio" size="sm">
        {editService && (
          <ServiceForm
            service={editService}
            onSuccess={() => { setEditService(null); qc.invalidateQueries({ queryKey: ['services'] }) }}
            onCancel={() => setEditService(null)}
          />
        )}
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar Servicio" size="sm">
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          ¿Estás seguro? Los clientes asignados a este servicio perderán la referencia pero sus datos no se borrarán.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => deleteId && handleDelete(deleteId)}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  )
}
