'use client'

import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ModalFooter } from '@/components/ui/modal'
import type { Empresa } from '@/types'
import toast from 'react-hot-toast'

interface FormData {
  name: string
  activity: string
  address: string
  city: string
  province: string
  website: string
}

interface Props {
  empresa?: Empresa
  onSuccess: (empresa: Empresa) => void
}

export function EmpresaForm({ empresa, onSuccess }: Props) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      name:     empresa?.name     ?? '',
      activity: empresa?.activity ?? '',
      address:  empresa?.address  ?? '',
      city:     empresa?.city     ?? '',
      province: empresa?.province ?? '',
      website:  empresa?.website  ?? '',
    },
  })

  const onSubmit = async (data: FormData) => {
    const url    = empresa ? `/api/empresas/${empresa.id}` : '/api/empresas'
    const method = empresa ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Error al guardar'); return }
    toast.success(empresa ? 'Empresa actualizada' : 'Empresa creada')
    onSuccess(json.data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          Empresa <span className="text-red-400">*</span>
        </label>
        <Input
          {...register('name', { required: 'El nombre es requerido' })}
          placeholder="Razón social o nombre comercial"
          error={errors.name?.message}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          Actividad
        </label>
        <Input {...register('activity')} placeholder="Ej: Seguridad electrónica, Instalaciones CCTV..." />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            Localidad
          </label>
          <Input {...register('city')} placeholder="Ciudad" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            Provincia
          </label>
          <Input {...register('province')} placeholder="Provincia" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          Domicilio
        </label>
        <Input {...register('address')} placeholder="Calle y número" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          Web
        </label>
        <Input {...register('website')} placeholder="https://empresa.com" />
      </div>

      <ModalFooter>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : empresa ? 'Guardar cambios' : 'Crear empresa'}
        </Button>
      </ModalFooter>
    </form>
  )
}
