'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'
import type { Client } from '@/types'

const schema = z.object({
  clientId: z.string().min(1, 'Seleccioná un cliente'),
  description: z.string().optional(),
  amount: z.coerce.number().positive('Debe ser mayor a 0'),
  currency: z.string().default('USD'),
  dueDate: z.string().min(1, 'Ingresá una fecha'),
  status: z.enum(['PENDING', 'PAID']).default('PENDING'),
})
type FormData = z.infer<typeof schema>

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD — Dólar' },
  { value: 'ARS', label: 'ARS — Peso Argentino' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'MXN', label: 'MXN — Peso Mexicano' },
  { value: 'CLP', label: 'CLP — Peso Chileno' },
  { value: 'COP', label: 'COP — Peso Colombiano' },
  { value: 'UYU', label: 'UYU — Peso Uruguayo' },
  { value: 'BRL', label: 'BRL — Real Brasileño' },
]

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pendiente de pago' },
  { value: 'PAID', label: 'Ya pagada' },
]

interface InvoiceFormProps {
  defaultClientId?: string
  onSuccess: (invoice: unknown) => void
  onCancel: () => void
}

export function InvoiceForm({ defaultClientId, onSuccess, onCancel }: InvoiceFormProps) {
  const [saving, setSaving] = useState(false)

  const { data: clientsData } = useQuery({
    queryKey: ['clients-all'],
    queryFn: async () => {
      const res = await fetch('/api/clients?limit=200')
      if (!res.ok) return []
      const json = await res.json()
      return (json.data ?? []) as Client[]
    },
    staleTime: 60 * 1000,
    enabled: !defaultClientId,
  })

  const clientOptions = defaultClientId
    ? []
    : [{ value: '', label: 'Seleccionar cliente...' }, ...(clientsData ?? []).map((c) => ({ value: c.id, label: c.name }))]

  const defaultDue = new Date()
  defaultDue.setDate(defaultDue.getDate() + 30)
  const defaultDueStr = defaultDue.toISOString().split('T')[0]

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId: defaultClientId ?? '',
      currency: 'USD',
      dueDate: defaultDueStr,
      status: 'PENDING',
    },
  })

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Error al crear factura')
        return
      }
      toast.success('Factura creada correctamente')
      onSuccess(json.data)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {!defaultClientId && (
        <Select
          label="Cliente"
          options={clientOptions}
          error={errors.clientId?.message}
          {...register('clientId')}
        />
      )}

      <Input
        label="Descripción (opcional)"
        placeholder="Ej: Servicio de SEO — Mayo 2026"
        {...register('description')}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Monto"
          type="number"
          step="0.01"
          placeholder="0.00"
          error={errors.amount?.message}
          {...register('amount')}
        />
        <Select
          label="Moneda"
          options={CURRENCY_OPTIONS}
          {...register('currency')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Vencimiento"
          type="date"
          error={errors.dueDate?.message}
          {...register('dueDate')}
        />
        <Select
          label="Estado inicial"
          options={STATUS_OPTIONS}
          {...register('status')}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving}>
          Crear Factura
        </Button>
      </div>
    </form>
  )
}
