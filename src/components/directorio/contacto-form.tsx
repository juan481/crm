'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ModalFooter } from '@/components/ui/modal'
import type { DirectorioContacto, Empresa } from '@/types'
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
  contacto?:         DirectorioContacto
  defaultEmpresaId?: string
  onSuccess:         (contacto: DirectorioContacto) => void
}

export function ContactoForm({ contacto, defaultEmpresaId, onSuccess }: Props) {
  const [empresas, setEmpresas] = useState<Empresa[]>([])

  useEffect(() => {
    fetch('/api/empresas?limit=200')
      .then(r => r.json())
      .then(j => setEmpresas(j.data ?? []))
      .catch(() => {})
  }, [])

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      firstName:  contacto?.firstName  ?? '',
      lastName:   contacto?.lastName   ?? '',
      companyRaw: contacto?.companyRaw ?? '',
      role:       contacto?.role       ?? '',
      email:      contacto?.email      ?? '',
      phone:      contacto?.phone      ?? '',
      empresaId:  contacto?.empresaId  ?? defaultEmpresaId ?? '',
    },
  })

  const onSubmit = async (data: FormData) => {
    const url    = contacto ? `/api/contactos/${contacto.id}` : '/api/contactos'
    const method = contacto ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, empresaId: data.empresaId || null }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Error al guardar'); return }
    toast.success(contacto ? 'Contacto actualizado' : 'Contacto creado')
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
          Cargo / Rol
        </label>
        <Input
          {...register('role')}
          placeholder="Ej: CEO, Dueño, Administrador técnico, Instalador..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            Mail
          </label>
          <Input {...register('email')} type="email" placeholder="contacto@empresa.com" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            Teléfono
          </label>
          <Input {...register('phone')} placeholder="+54 11 1234-5678" />
        </div>
      </div>

      <div
        className="rounded-xl p-3 space-y-3"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}
      >
        <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          Vinculación a empresa
        </p>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            Empresa (texto libre)
          </label>
          <Input
            {...register('companyRaw')}
            placeholder="Si no la encontrás abajo, escribila aquí y se vinculará automáticamente"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            Vincular empresa (selección directa)
          </label>
          <select
            {...register('empresaId')}
            className="w-full px-3 py-2 rounded-xl text-sm"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            <option value="">— Sin vincular (auto-detectar por texto o mail) —</option>
            {empresas.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
      </div>

      <ModalFooter>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : contacto ? 'Guardar cambios' : 'Crear contacto'}
        </Button>
      </ModalFooter>
    </form>
  )
}
