'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ModalFooter } from '@/components/ui/modal'
import type { Empresa, Tecnico } from '@/types'
import toast from 'react-hot-toast'

interface FormData {
  firstName:  string
  lastName:   string
  companyRaw: string
  role:       string
  email:      string
  phone:      string
  empresaId:  string
}

interface Props {
  tecnico?:        Tecnico
  defaultEmpresaId?: string
  onSuccess:       (tecnico: Tecnico) => void
}

export function TecnicoForm({ tecnico, defaultEmpresaId, onSuccess }: Props) {
  const [empresas, setEmpresas] = useState<Empresa[]>([])

  useEffect(() => {
    fetch('/api/empresas?limit=200')
      .then(r => r.json())
      .then(j => setEmpresas(j.data ?? []))
      .catch(() => {})
  }, [])

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      firstName:  tecnico?.firstName  ?? '',
      lastName:   tecnico?.lastName   ?? '',
      companyRaw: tecnico?.companyRaw ?? '',
      role:       tecnico?.role       ?? '',
      email:      tecnico?.email      ?? '',
      phone:      tecnico?.phone      ?? '',
      empresaId:  tecnico?.empresaId  ?? defaultEmpresaId ?? '',
    },
  })

  const onSubmit = async (data: FormData) => {
    const url    = tecnico ? `/api/tecnicos/${tecnico.id}` : '/api/tecnicos'
    const method = tecnico ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        empresaId: data.empresaId || null,
      }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Error al guardar'); return }
    toast.success(tecnico ? 'Técnico actualizado' : 'Técnico creado')
    onSuccess(json.data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            Nombre <span className="text-red-400">*</span>
          </label>
          <Input
            {...register('firstName', { required: 'Requerido' })}
            placeholder="Nombre"
            error={errors.firstName?.message}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            Apellido <span className="text-red-400">*</span>
          </label>
          <Input
            {...register('lastName', { required: 'Requerido' })}
            placeholder="Apellido"
            error={errors.lastName?.message}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          Empresa (texto)
        </label>
        <Input
          {...register('companyRaw')}
          placeholder="Nombre de empresa (se usará para vincular automáticamente)"
        />
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Si el nombre coincide con una empresa del directorio, se vinculará solo.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          Vincular empresa (manual)
        </label>
        <select
          {...register('empresaId')}
          className="w-full px-3 py-2 rounded-xl text-sm"
          style={{
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
        >
          <option value="">— Sin vincular (auto-detectar) —</option>
          {empresas.map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          Cargo
        </label>
        <Input {...register('role')} placeholder="Ej: Administrador técnico, Dueño, Instalador..." />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            Mail
          </label>
          <Input {...register('email')} type="email" placeholder="tecnico@empresa.com" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            Teléfono
          </label>
          <Input {...register('phone')} placeholder="+54 11 1234-5678" />
        </div>
      </div>

      <ModalFooter>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : tecnico ? 'Guardar cambios' : 'Crear técnico'}
        </Button>
      </ModalFooter>
    </form>
  )
}
