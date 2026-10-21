'use client'

import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ModalFooter } from '@/components/ui/modal'
import toast from 'react-hot-toast'

interface Vigilador {
  id: string
  nombre: string
  apellido: string
  dni: string
  fechaIngreso: string | null
  carnetVencimiento: string | null
  art: string | null
  lugarTrabajo: string | null
  notas: string | null
  activo?: boolean
}

interface FormData {
  nombre: string
  apellido: string
  dni: string
  fechaIngreso: string
  carnetVencimiento: string
  art: string
  lugarTrabajo: string
  notas: string
  activo: boolean
}

// Fecha de un <input type="date"> en texto ("YYYY-MM-DD") ↔ ISO guardado en
// el backend — mismo recorte que hace el resto del CRM con estos inputs.
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '')

interface Props {
  vigilador?: Vigilador
  onSuccess: (vigilador: Vigilador) => void
}

export function LegajoForm({ vigilador, onSuccess }: Props) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      nombre: vigilador?.nombre ?? '',
      apellido: vigilador?.apellido ?? '',
      dni: vigilador?.dni ?? '',
      fechaIngreso: toDateInput(vigilador?.fechaIngreso ?? null),
      carnetVencimiento: toDateInput(vigilador?.carnetVencimiento ?? null),
      art: vigilador?.art ?? '',
      lugarTrabajo: vigilador?.lugarTrabajo ?? '',
      notas: vigilador?.notas ?? '',
      activo: vigilador?.activo ?? true,
    },
  })

  const onSubmit = async (data: FormData) => {
    const url = vigilador ? `/api/legajos/${vigilador.id}` : '/api/legajos'
    const method = vigilador ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        fechaIngreso: data.fechaIngreso || null,
        carnetVencimiento: data.carnetVencimiento || null,
        art: data.art || null,
        lugarTrabajo: data.lugarTrabajo || null,
        notas: data.notas || null,
        activo: data.activo,
      }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Error al guardar'); return }
    toast.success(vigilador ? 'Legajo actualizado' : 'Legajo creado')
    onSuccess(json.data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            Nombre <span className="text-red-400">*</span>
          </label>
          <Input {...register('nombre', { required: 'Requerido' })} placeholder="Nombre" error={errors.nombre?.message} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            Apellido <span className="text-red-400">*</span>
          </label>
          <Input {...register('apellido', { required: 'Requerido' })} placeholder="Apellido" error={errors.apellido?.message} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          DNI <span className="text-red-400">*</span>
        </label>
        <Input {...register('dni', { required: 'Requerido' })} placeholder="DNI" error={errors.dni?.message} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            Fecha de ingreso
          </label>
          <Input {...register('fechaIngreso')} type="date" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            Vencimiento del carnet
          </label>
          <Input {...register('carnetVencimiento')} type="date" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            ART
          </label>
          <Input {...register('art')} placeholder="Aseguradora / N° de póliza" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            Lugar de trabajo
          </label>
          <Input {...register('lugarTrabajo')} placeholder="Sitio / obra asignada" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          Notas
        </label>
        <textarea
          {...register('notas')}
          rows={3}
          className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        />
      </div>

      {/* Sólo al editar — un legajo nuevo siempre arranca activo (default
          del schema), no tiene sentido mostrar el toggle al crearlo. */}
      {vigilador && (
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-text)' }}>
          <input type="checkbox" {...register('activo')} className="w-4 h-4 rounded" />
          Legajo activo
        </label>
      )}

      <ModalFooter>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : vigilador ? 'Guardar cambios' : 'Crear legajo'}
        </Button>
      </ModalFooter>
    </form>
  )
}
