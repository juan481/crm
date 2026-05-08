'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ModalFooter } from '@/components/ui/modal'
import { COUNTRIES } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Client } from '@/types'

const schema = z.object({
  // Info
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  company: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  province: z.string().optional(),
  website: z.string().optional(),
  status: z.string().optional(),
  mrr: z.string().optional(),
  contractStart: z.string().optional(),
  contractEnd: z.string().optional(),
  serviceType: z.string().optional(),
  // Clasificación
  clientType: z.string().optional(),
  isEnabled: z.boolean().optional(),
  // Licencia
  licenseSerial: z.string().optional(),
  licenseVersion: z.string().optional(),
  maxWorkstations: z.string().optional(),
  subscriptionStart: z.string().optional(),
  subscriptionEnd: z.string().optional(),
  licenseHibernated: z.boolean().optional(),
  licenseRepurchased: z.boolean().optional(),
  isActive24x7: z.boolean().optional(),
  // Comercial
  distributorName: z.string().optional(),
  totalInvestment: z.string().optional(),
  renewalCount: z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface ClientFormProps {
  client?: Client
  onSuccess: (client: Client) => void
  onCancel: () => void
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'PROSPECT', label: 'Prospecto' },
  { value: 'PENDING_PAYMENT', label: 'Pago Pendiente' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'EXPIRED', label: 'Vencido' },
]

const SERVICE_OPTIONS = [
  { value: '', label: 'Sin asignar' },
  { value: 'SEO', label: 'SEO' },
  { value: 'Ads', label: 'Publicidad Digital' },
  { value: 'Social Media', label: 'Social Media' },
  { value: 'Web Design', label: 'Diseño Web' },
  { value: 'Content', label: 'Contenidos' },
  { value: 'Full Service', label: 'Full Service' },
  { value: 'SEO + Ads', label: 'SEO + Ads' },
  { value: 'Otro', label: 'Otro' },
]

const CLIENT_TYPE_OPTIONS = [
  { value: 'B2B', label: 'B2B (Empresa)' },
  { value: 'B2C', label: 'B2C (Consumidor)' },
]

type TabKey = 'info' | 'clasificacion' | 'licencia' | 'comercial'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'info', label: 'Información' },
  { key: 'clasificacion', label: 'Clasificación' },
  { key: 'licencia', label: 'Licencia' },
  { key: 'comercial', label: 'Comercial' },
]

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border-strong)]'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

export function ClientForm({ client, onSuccess, onCancel }: ClientFormProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('info')

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: client?.name ?? '',
      email: client?.email ?? '',
      phone: client?.phone ?? '',
      company: client?.company ?? '',
      country: client?.country ?? '',
      city: client?.city ?? '',
      address: client?.address ?? '',
      postalCode: client?.postalCode ?? '',
      province: client?.province ?? '',
      website: client?.website ?? '',
      serviceType: client?.serviceType ?? '',
      mrr: client?.mrr ? String(client.mrr) : '',
      status: client?.status ?? 'ACTIVE',
      contractStart: client?.contractStart?.split('T')[0] ?? '',
      contractEnd: client?.contractEnd?.split('T')[0] ?? '',
      clientType: client?.clientType ?? 'B2B',
      isEnabled: client?.isEnabled ?? true,
      licenseSerial: client?.licenseSerial ?? '',
      licenseVersion: client?.licenseVersion ?? '',
      maxWorkstations: client?.maxWorkstations ? String(client.maxWorkstations) : '',
      subscriptionStart: client?.subscriptionStart?.split('T')[0] ?? '',
      subscriptionEnd: client?.subscriptionEnd?.split('T')[0] ?? '',
      licenseHibernated: client?.licenseHibernated ?? false,
      licenseRepurchased: client?.licenseRepurchased ?? false,
      isActive24x7: client?.isActive24x7 ?? false,
      distributorName: client?.distributorName ?? '',
      totalInvestment: client?.totalInvestment ? String(client.totalInvestment) : '',
      renewalCount: client?.renewalCount ? String(client.renewalCount) : '0',
    },
  })

  const onSubmit = async (data: FormData) => {
    const url = client ? `/api/clients/${client.id}` : '/api/clients'
    const method = client ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        mrr: data.mrr ? Number(data.mrr) : 0,
        phone: data.phone || null,
        company: data.company || null,
        country: data.country || null,
        city: data.city || null,
        address: data.address || null,
        postalCode: data.postalCode || null,
        province: data.province || null,
        website: data.website || null,
        serviceType: data.serviceType || null,
        contractStart: data.contractStart || null,
        contractEnd: data.contractEnd || null,
        clientType: data.clientType ?? 'B2B',
        isEnabled: data.isEnabled ?? true,
        licenseSerial: data.licenseSerial || null,
        licenseVersion: data.licenseVersion || null,
        maxWorkstations: data.maxWorkstations ? Number(data.maxWorkstations) : null,
        subscriptionStart: data.subscriptionStart || null,
        subscriptionEnd: data.subscriptionEnd || null,
        licenseHibernated: data.licenseHibernated ?? false,
        licenseRepurchased: data.licenseRepurchased ?? false,
        isActive24x7: data.isActive24x7 ?? false,
        distributorName: data.distributorName || null,
        totalInvestment: data.totalInvestment ? Number(data.totalInvestment) : null,
        renewalCount: data.renewalCount ? Number(data.renewalCount) : 0,
      }),
    })

    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error ?? 'Error al guardar')
      return
    }

    toast.success(client ? 'Cliente actualizado' : 'Cliente creado exitosamente')
    onSuccess(json.data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Tab nav */}
      <div className="flex gap-1 p-1 bg-[var(--color-bg)] rounded-xl border border-[var(--color-border)]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-all ${
              activeTab === tab.key
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Información */}
      {activeTab === 'info' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Nombre *" placeholder="Juan Pérez" error={errors.name?.message} {...register('name')} />
            <Input label="Email *" type="email" placeholder="juan@empresa.com" error={errors.email?.message} {...register('email')} />
            <Input label="Teléfono" placeholder="+54 11 1234 5678" {...register('phone')} />
            <Input label="Empresa" placeholder="Nombre de la empresa" {...register('company')} />
            <Select label="País" options={[{ value: '', label: 'Seleccionar...' }, ...COUNTRIES.map((c) => ({ value: c, label: c }))]} {...register('country')} />
            <Input label="Ciudad" placeholder="Buenos Aires" {...register('city')} />
            <Input label="Provincia / Estado" placeholder="Buenos Aires" {...register('province')} />
            <Input label="Código Postal" placeholder="1425" {...register('postalCode')} />
          </div>
          <Input label="Dirección" placeholder="Av. Corrientes 1234" {...register('address')} />
          <Input label="Sitio Web" placeholder="https://empresa.com" {...register('website')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label="Estado" options={STATUS_OPTIONS} {...register('status')} />
            <Select label="Tipo de Servicio" options={SERVICE_OPTIONS} {...register('serviceType')} />
            <Input label="MRR (USD)" type="number" min="0" step="0.01" placeholder="0.00" {...register('mrr')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Inicio de Contrato" type="date" {...register('contractStart')} />
            <Input label="Fin de Contrato" type="date" {...register('contractEnd')} />
          </div>
        </div>
      )}

      {/* Tab: Clasificación */}
      {activeTab === 'clasificacion' && (
        <div className="space-y-1">
          <Select label="Tipo de Cliente" options={CLIENT_TYPE_OPTIONS} {...register('clientType')} />
          <div className="pt-2 space-y-1 divide-y divide-[var(--color-border)]">
            <Controller
              control={control}
              name="isEnabled"
              render={({ field }) => (
                <Toggle label="Cliente habilitado" checked={!!field.value} onChange={field.onChange} />
              )}
            />
          </div>
        </div>
      )}

      {/* Tab: Licencia */}
      {activeTab === 'licencia' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Número de Serial" placeholder="SN-00000-XXXXX" {...register('licenseSerial')} />
            <Input label="Versión" placeholder="v2.5.1" {...register('licenseVersion')} />
            <Input label="Puestos máximos" type="number" min="0" placeholder="5" {...register('maxWorkstations')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Inicio de Suscripción" type="date" {...register('subscriptionStart')} />
            <Input label="Fin de Suscripción" type="date" {...register('subscriptionEnd')} />
          </div>
          <div className="pt-2 space-y-1 divide-y divide-[var(--color-border)]">
            <Controller control={control} name="licenseHibernated" render={({ field }) => (
              <Toggle label="Licencia Hibernada" checked={!!field.value} onChange={field.onChange} />
            )} />
            <Controller control={control} name="licenseRepurchased" render={({ field }) => (
              <Toggle label="Recompra de Licencia" checked={!!field.value} onChange={field.onChange} />
            )} />
            <Controller control={control} name="isActive24x7" render={({ field }) => (
              <Toggle label="Soporte 24x7" checked={!!field.value} onChange={field.onChange} />
            )} />
          </div>
        </div>
      )}

      {/* Tab: Comercial */}
      {activeTab === 'comercial' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Distribuidor" placeholder="Nombre del distribuidor" {...register('distributorName')} />
            <Input label="Inversión Total (USD)" type="number" min="0" step="0.01" placeholder="0.00" {...register('totalInvestment')} />
            <Input label="Cantidad de Renovaciones" type="number" min="0" placeholder="0" {...register('renewalCount')} />
          </div>
        </div>
      )}

      <ModalFooter>
        <Button variant="ghost" onClick={onCancel} type="button">Cancelar</Button>
        <Button type="submit" loading={isSubmitting}>
          {client ? 'Guardar Cambios' : 'Crear Cliente'}
        </Button>
      </ModalFooter>
    </form>
  )
}
