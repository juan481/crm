'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ModalFooter } from '@/components/ui/modal'
import { UserPlus, ChevronDown, ChevronUp } from 'lucide-react'
import { ARGENTINA_PROVINCES, CITIES_BY_PROVINCE } from '@/lib/argentina-geo'
import { COUNTRIES } from '@/lib/utils'
import type { Empresa } from '@/types'
import toast from 'react-hot-toast'

interface FormData {
  name:     string
  activity: string
  address:  string
  country:  string
  otherCountry: string
  city:     string
  province: string
  website:  string
  tcFirstName: string
  tcLastName:  string
  tcRole:      string
  tcEmail:     string
  tcPhone:     string
}

interface Props {
  empresa?:  Empresa
  onSuccess: (empresa: Empresa) => void
}

const OTHER_COUNTRY = 'Otro'
const KNOWN_COUNTRIES = COUNTRIES.filter(c => c !== OTHER_COUNTRY)
const COUNTRY_OPTIONS = COUNTRIES.map(c => ({ value: c, label: c }))

const PROVINCE_OPTIONS = [
  { value: '', label: '— Seleccionar provincia —' },
  ...ARGENTINA_PROVINCES.map(p => ({ value: p, label: p })),
]

export function EmpresaForm({ empresa, onSuccess }: Props) {
  const [addContact, setAddContact] = useState(false)

  // Si ya tiene un país cargado que no está en la lista curada, se trata
  // como "Otro" con el valor real precargado en el campo libre — mismo
  // criterio que ya usaba `city` para no perder un valor existente que no
  // está en las listas armadas.
  const initialCountry = empresa?.country
    ? (KNOWN_COUNTRIES.includes(empresa.country) ? empresa.country : OTHER_COUNTRY)
    : 'Argentina'
  const initialOtherCountry = empresa?.country && !KNOWN_COUNTRIES.includes(empresa.country)
    ? empresa.country
    : ''

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      name:        empresa?.name     ?? '',
      activity:    empresa?.activity ?? '',
      address:     empresa?.address  ?? '',
      country:     initialCountry,
      otherCountry: initialOtherCountry,
      city:        empresa?.city     ?? '',
      province:    empresa?.province ?? '',
      website:     empresa?.website  ?? '',
      tcFirstName: '',
      tcLastName:  '',
      tcRole:      '',
      tcEmail:     '',
      tcPhone:     '',
    },
  })

  const selectedProvince = watch('province')
  const selectedCountry  = watch('country')
  const isArgentina      = selectedCountry === 'Argentina'
  const isOtherCountry   = selectedCountry === OTHER_COUNTRY

  // Build city options for the selected province. If editing and city isn't in the list, add it.
  const provinceCities = selectedProvince ? (CITIES_BY_PROVINCE[selectedProvince] ?? []) : []
  const existingCity   = empresa?.city ?? ''
  const cityList       = (existingCity && !provinceCities.includes(existingCity))
    ? [existingCity, ...provinceCities]
    : provinceCities
  const CITY_OPTIONS   = [
    { value: '', label: selectedProvince ? '— Seleccionar localidad —' : '— Primero seleccioná provincia —' },
    ...cityList.map(c => ({ value: c, label: c })),
  ]

  const onSubmit = async (data: FormData) => {
    const url    = empresa ? `/api/empresas/${empresa.id}` : '/api/empresas'
    const method = empresa ? 'PUT' : 'POST'
    const finalCountry = data.country === OTHER_COUNTRY
      ? (data.otherCountry.trim() || OTHER_COUNTRY)
      : data.country

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:     data.name,
        activity: data.activity,
        address:  data.address,
        country:  finalCountry,
        city:     data.city,
        province: data.province,
        website:  data.website,
      }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Error al guardar'); return }

    const savedEmpresa: Empresa = json.data

    if (!empresa && addContact && data.tcFirstName.trim() && data.tcLastName.trim()) {
      const tcRes = await fetch('/api/contactos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName:  data.tcFirstName.trim(),
          lastName:   data.tcLastName.trim(),
          role:       data.tcRole.trim()  || null,
          email:      data.tcEmail.trim() || null,
          phone:      data.tcPhone.trim() || null,
          companyRaw: savedEmpresa.name,
          empresaId:  savedEmpresa.id,
        }),
      })
      if (!tcRes.ok) {
        const tcJson = await tcRes.json()
        toast.error(`Empresa creada pero error al crear el técnico: ${tcJson.error}`)
        onSuccess(savedEmpresa)
        return
      }
      toast.success('Empresa y técnico creados')
    } else {
      toast.success(empresa ? 'Empresa actualizada' : 'Empresa creada')
    }

    onSuccess(savedEmpresa)
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

      <div className={isOtherCountry ? 'grid grid-cols-2 gap-3' : ''}>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>País</label>
          <Select
            {...register('country')}
            options={COUNTRY_OPTIONS}
          />
        </div>
        {isOtherCountry && (
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
              ¿Cuál? <span className="text-red-400">*</span>
            </label>
            <Input
              {...register('otherCountry', {
                validate: v => !isOtherCountry || v.trim() !== '' || 'Especificá el país',
              })}
              placeholder="Nombre del país"
              error={errors.otherCountry?.message}
            />
          </div>
        )}
      </div>

      {/* Argentina tiene listas curadas de provincia/localidad (con
          autocompletado real); para cualquier otro país no hay esa data
          armada, así que quedan como texto libre — cubre el caso real de
          Just Create con clientes en España e Inglaterra. */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            {isArgentina ? 'Provincia' : 'Provincia / Estado'}
          </label>
          {isArgentina ? (
            <Select {...register('province')} options={PROVINCE_OPTIONS} />
          ) : (
            <Input {...register('province')} placeholder="Provincia, estado o región" />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            {isArgentina ? 'Localidad' : 'Localidad / Ciudad'}
          </label>
          {isArgentina ? (
            <Select {...register('city')} options={CITY_OPTIONS} disabled={!selectedProvince} />
          ) : (
            <Input {...register('city')} placeholder="Ciudad" />
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>Domicilio</label>
        <Input {...register('address')} placeholder="Calle y número" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>Web</label>
        <Input {...register('website')} placeholder="https://empresa.com" />
      </div>

      {/* Primer contacto (solo en alta nueva) */}
      {!empresa && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          <button
            type="button"
            onClick={() => setAddContact(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--color-surface-raised)]"
            style={{ color: 'var(--color-text)', background: 'var(--color-surface-raised)' }}
          >
            <span className="flex items-center gap-2">
              <UserPlus size={15} style={{ color: 'var(--color-primary)' }} />
              Agregar primer técnico/contacto ahora (opcional)
            </span>
            {addContact ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {addContact && (
            <div className="px-4 pb-4 pt-3 space-y-3" style={{ background: 'var(--color-surface)' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Todos los campos del contacto están disponibles desde el inicio.
                Podés completar solo los que tenés y agregar más desde el perfil de la empresa.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                    Nombre <span className="text-red-400">*</span>
                  </label>
                  <Input
                    {...register('tcFirstName', {
                      validate: v => !addContact || v.trim() !== '' || 'Requerido si agregás un contacto',
                    })}
                    placeholder="Nombre"
                    error={errors.tcFirstName?.message}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                    Apellido <span className="text-red-400">*</span>
                  </label>
                  <Input
                    {...register('tcLastName', {
                      validate: v => !addContact || v.trim() !== '' || 'Requerido si agregás un contacto',
                    })}
                    placeholder="Apellido"
                    error={errors.tcLastName?.message}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text)' }}>Cargo</label>
                <Input
                  {...register('tcRole')}
                  placeholder="Ej: Administrador técnico, Dueño, Instalador..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text)' }}>Mail</label>
                  <Input {...register('tcEmail')} type="email" placeholder="tecnico@empresa.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text)' }}>Teléfono</label>
                  <Input {...register('tcPhone')} placeholder="+54 11 1234-5678" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <ModalFooter>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : empresa ? 'Guardar cambios' : 'Crear empresa'}
        </Button>
      </ModalFooter>
    </form>
  )
}
