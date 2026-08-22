'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Mail, Phone, PhoneCall, MessageCircle, Building2, Pencil, Trash2, UserCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar } from '@/components/ui/avatar'
import { ContactoForm } from '@/components/directorio/contacto-form'
import { ContactoNotas, type ContactoNotasHandle } from '@/components/directorio/contacto-notas'
import { WhatsAppSendButton } from '@/components/integrations/whatsapp-send-button'
import { useAuthStore } from '@/store/auth-store'
import type { DirectorioContacto } from '@/types'
import toast from 'react-hot-toast'

export default function ContactoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const notasRef = useRef<ContactoNotasHandle>(null)

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'

  const { data, isLoading, isError } = useQuery<DirectorioContacto>({
    queryKey: ['contacto', id],
    queryFn: async () => {
      const res = await fetch(`/api/contactos/${id}`)
      if (!res.ok) throw new Error('Contacto no encontrado')
      return res.json().then(j => j.data)
    },
  })

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/contactos/${id}`, { method: 'DELETE' })
      if (!res.ok) { const j = await res.json(); toast.error(j.error ?? 'Error al eliminar'); return }
      toast.success('Contacto eliminado')
      router.push('/contactos')
    } catch {
      toast.error('Error de conexión')
    } finally {
      setDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="text-center py-16" style={{ color: 'var(--color-text-muted)' }}>
        <UserCircle2 size={32} className="mx-auto mb-3 opacity-30" />
        <p className="font-medium">No se encontró el contacto</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/contactos')}>Volver a Contactos</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <button
        onClick={() => router.push('/contactos')}
        className="flex items-center gap-1.5 text-sm hover:underline"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={14} /> Contactos
      </button>

      <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar name={`${data.firstName} ${data.lastName}`} size="lg" />
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                {data.firstName} {data.lastName}
              </h1>
              {data.role && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{data.role}</p>}
            </div>
          </div>
          {canManage && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setEditing(true)}
                className="p-2 rounded-lg transition-colors hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
                style={{ color: 'var(--color-text-muted)' }}
                title="Editar"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-2 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-400"
                style={{ color: 'var(--color-text-muted)' }}
                title="Eliminar"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t space-y-2" style={{ borderColor: 'var(--color-border)' }}>
          {data.empresa ? (
            <button
              onClick={() => router.push(`/empresas/${data.empresa!.id}`)}
              className="flex items-center gap-2 text-sm hover:underline"
              style={{ color: 'var(--color-primary)' }}
            >
              <Building2 size={14} /> Ver empresa: {data.empresa.name}
            </button>
          ) : data.companyRaw ? (
            <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              <Building2 size={14} /> {data.companyRaw} (sin vincular a ninguna empresa del sistema)
            </p>
          ) : null}

          {data.email && (
            <a href={`mailto:${data.email}`} className="flex items-center gap-2 text-sm hover:underline" style={{ color: 'var(--color-text)' }}>
              <Mail size={14} style={{ color: 'var(--color-text-muted)' }} /> {data.email}
            </a>
          )}
          {data.phone && (
            <div className="flex items-center gap-3 flex-wrap">
              <a
                href={`https://wa.me/${data.phone.replace(/\D/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm hover:underline"
                style={{ color: 'var(--color-text)' }}
              >
                <MessageCircle size={14} style={{ color: '#22c55e' }} /> {data.phone}
              </a>
              <WhatsAppSendButton phone={data.phone} name={`${data.firstName} ${data.lastName}`} />
              <a
                href={`tel:${data.phone.replace(/\s+/g, '')}`}
                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}
                title="Llamar"
              >
                <Phone size={12} /> Llamar
              </a>
              <button
                type="button"
                onClick={() => notasRef.current?.focusCall()}
                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors hover:opacity-80"
                style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
                title="Registrar llamada"
              >
                <PhoneCall size={12} /> Registrar llamada
              </button>
            </div>
          )}
          {!data.email && !data.phone && (
            <p className="text-sm" style={{ color: 'var(--color-text-subtle)' }}>Sin mail ni teléfono cargados.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <ContactoNotas ref={notasRef} contactoId={data.id} />
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Editar contacto" size="md">
        <ContactoForm
          contacto={data}
          onSuccess={() => { setEditing(false); qc.invalidateQueries({ queryKey: ['contacto', id] }) }}
        />
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Eliminar contacto" size="sm">
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          ¿Confirmás la eliminación de {data.firstName} {data.lastName}? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
