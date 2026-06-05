'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Edit, Trash2, Building2, MapPin, Globe,
  Briefcase, Plus, Mail, Phone, UserCircle2, UserCheck, UserX,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { EmpresaForm } from '@/components/directorio/empresa-form'
import { ContactoForm } from '@/components/directorio/contacto-form'
import { EmpresaNotas } from '@/components/directorio/empresa-notas'
import { EmpresaCotizaciones } from '@/components/directorio/empresa-cotizaciones'
import { useAuthStore } from '@/store/auth-store'
import type { DirectorioContacto, Empresa } from '@/types'
import toast from 'react-hot-toast'

export default function EmpresaDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const qc       = useQueryClient()
  const { user } = useAuthStore()

  const [editOpen,          setEditOpen]          = useState(false)
  const [addContactoOpen,   setAddContactoOpen]   = useState(false)
  const [deleteOpen,        setDeleteOpen]        = useState(false)
  const [deleteContactoId,  setDeleteContactoId]  = useState<string | null>(null)
  const [deleting,          setDeleting]          = useState(false)
  const [togglingCliente,   setTogglingCliente]   = useState(false)

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'

  const { data, isLoading } = useQuery({
    queryKey: ['empresa', id],
    queryFn: async () => {
      const res = await fetch(`/api/empresas/${id}`)
      if (!res.ok) throw new Error('No encontrada')
      return res.json().then((j: { data: Empresa }) => j.data)
    },
  })

  const empresa: Empresa | undefined = data

  const handleToggleCliente = async () => {
    if (!empresa) return
    setTogglingCliente(true)
    try {
      const res = await fetch(`/api/empresas/${id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:      empresa.name,
          activity:  empresa.activity,
          address:   empresa.address,
          city:      empresa.city,
          province:  empresa.province,
          country:   empresa.country,
          website:   empresa.website,
          isCliente: !empresa.isCliente,
        }),
      })
      if (res.ok) {
        toast.success(empresa.isCliente ? 'Empresa desmarcada como cliente' : '¡Empresa marcada como cliente!')
        qc.invalidateQueries({ queryKey: ['empresa', id] })
        qc.invalidateQueries({ queryKey: ['empresas'] })
        qc.invalidateQueries({ queryKey: ['empresas-clientes'] })
      } else {
        const j = await res.json()
        toast.error(j.error)
      }
    } catch { toast.error('Error de conexión') }
    finally { setTogglingCliente(false) }
  }

  const handleDeleteEmpresa = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/empresas/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Empresa eliminada')
        qc.invalidateQueries({ queryKey: ['empresas'] })
        router.push('/empresas')
      } else {
        const j = await res.json()
        toast.error(j.error)
      }
    } catch { toast.error('Error de conexión') }
    finally { setDeleting(false); setDeleteOpen(false) }
  }

  const handleDeleteContacto = async () => {
    if (!deleteContactoId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/contactos/${deleteContactoId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Contacto eliminado')
        qc.invalidateQueries({ queryKey: ['empresa', id] })
      } else {
        const j = await res.json()
        toast.error(j.error)
      }
    } catch { toast.error('Error de conexión') }
    finally { setDeleting(false); setDeleteContactoId(null) }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded animate-pulse" style={{ background: 'var(--color-border)' }} />
        <div className="h-40 rounded-2xl animate-pulse" style={{ background: 'var(--color-border)' }} />
      </div>
    )
  }

  if (!empresa) {
    return (
      <div className="text-center py-20" style={{ color: 'var(--color-text-muted)' }}>
        Empresa no encontrada.
        <Button variant="ghost" className="ml-2" onClick={() => router.push('/empresas')}>Volver</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap justify-between">
        <button
          onClick={() => router.push('/empresas')}
          className="flex items-center gap-2 text-sm transition-colors hover:opacity-80"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <ArrowLeft size={15} /> Empresas
        </button>
        {canManage && (
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={empresa?.isCliente ? 'outline' : 'secondary'}
              onClick={handleToggleCliente}
              disabled={togglingCliente}
            >
              {empresa?.isCliente
                ? <><UserX size={14} /> Quitar cliente</>
                : <><UserCheck size={14} /> Marcar como cliente</>}
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Edit size={14} /> Editar
            </Button>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={14} /> Eliminar
            </Button>
          </div>
        )}
      </div>

      {/* Empresa info card */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
            <Building2 size={26} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{empresa.name}</h1>
              {empresa.isCliente && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--color-primary)', color: '#fff' }}>
                  <UserCheck size={11} /> Cliente
                </span>
              )}
            </div>
            {empresa.activity && (
              <p className="text-sm flex items-center gap-1.5 mb-3" style={{ color: 'var(--color-text-muted)' }}>
                <Briefcase size={13} /> {empresa.activity}
              </p>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {(empresa.city || empresa.province) && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={13} />
                  {[empresa.city, empresa.province].filter(Boolean).join(', ')}
                </span>
              )}
              {empresa.address && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={13} /> {empresa.address}
                </span>
              )}
              {empresa.website && (
                <a
                  href={empresa.website.startsWith('http') ? empresa.website : `https://${empresa.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:underline"
                  style={{ color: 'var(--color-primary)' }}
                >
                  <Globe size={13} /> {empresa.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Activity / Notas section */}
      <EmpresaNotas empresaId={id} empresaNombre={empresa.name} />

      {/* Cotizaciones / historial */}
      <EmpresaCotizaciones empresaId={id} />

      {/* Contactos section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
            Contactos
            <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full"
              style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
              {empresa.contactos?.length ?? 0}
            </span>
          </h2>
          {canManage && (
            <Button size="sm" onClick={() => setAddContactoOpen(true)}>
              <Plus size={13} /> Agregar contacto
            </Button>
          )}
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Nombre</th>
                <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>Cargo</th>
                <th className="px-4 py-3 text-left font-semibold hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>Mail</th>
                <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell" style={{ color: 'var(--color-text-muted)' }}>Teléfono</th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {!empresa.contactos?.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center" style={{ color: 'var(--color-text-muted)' }}>
                    <UserCircle2 size={28} className="mx-auto mb-2 opacity-30" />
                    <p>No hay contactos vinculados aún</p>
                    <p className="text-xs mt-0.5">Podés agregar CEOs, dueños, técnicos, administrativos...</p>
                  </td>
                </tr>
              ) : (
                empresa.contactos.map((c: DirectorioContacto) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="px-4 py-3">
                      <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                        {c.firstName} {c.lastName}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>
                      {c.role ?? '—'}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {c.email ? (
                        <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:underline"
                          style={{ color: 'var(--color-primary)' }}>
                          <Mail size={12} /> {c.email}
                        </a>
                      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {c.phone ? (
                        <a href={`tel:${c.phone}`} className="flex items-center gap-1.5"
                          style={{ color: 'var(--color-text-muted)' }}>
                          <Phone size={12} /> {c.phone}
                        </a>
                      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setDeleteContactoId(c.id)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-400"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar empresa" size="md">
        <EmpresaForm
          empresa={empresa}
          onSuccess={() => {
            setEditOpen(false)
            qc.invalidateQueries({ queryKey: ['empresa', id] })
            qc.invalidateQueries({ queryKey: ['empresas'] })
          }}
        />
      </Modal>

      <Modal open={addContactoOpen} onClose={() => setAddContactoOpen(false)} title="Agregar contacto" size="md">
        <ContactoForm
          defaultEmpresaId={id}
          onSuccess={() => {
            setAddContactoOpen(false)
            qc.invalidateQueries({ queryKey: ['empresa', id] })
          }}
        />
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Eliminar empresa" size="sm">
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          ¿Eliminás <strong>{empresa.name}</strong>? Los contactos vinculados quedarán sin vínculo.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDeleteEmpresa} disabled={deleting}>
            {deleting ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </div>
      </Modal>

      <Modal open={!!deleteContactoId} onClose={() => setDeleteContactoId(null)} title="Eliminar contacto" size="sm">
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          ¿Confirmás la eliminación de este contacto?
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleteContactoId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDeleteContacto} disabled={deleting}>
            {deleting ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
