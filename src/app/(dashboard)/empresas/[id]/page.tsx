'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Edit, Trash2, Building2, MapPin, Globe,
  Briefcase, Plus, Mail, UserCircle2, UserCheck, UserX, MessageCircle,
  Send, X, CheckSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal, ModalFooter } from '@/components/ui/modal'
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

  // Email selectivo
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set())
  const [emailModalOpen,     setEmailModalOpen]     = useState(false)
  const [emailSubject,       setEmailSubject]       = useState('')
  const [emailBody,          setEmailBody]          = useState('')
  const [sendingEmail,       setSendingEmail]       = useState(false)

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'
  const canSell   = canManage || user?.role === 'SELLER'

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

  const toggleContact = (contactId: string) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev)
      if (next.has(contactId)) next.delete(contactId)
      else next.add(contactId)
      return next
    })
  }

  const clearSelection = () => setSelectedContactIds(new Set())

  const openEmailModal = () => {
    setEmailSubject('')
    setEmailBody('')
    setEmailModalOpen(true)
  }

  const handleSendEmail = async () => {
    if (!emailSubject.trim()) { toast.error('El asunto es requerido'); return }
    if (!emailBody.trim())    { toast.error('El mensaje es requerido'); return }

    setSendingEmail(true)
    try {
      const res  = await fetch(`/api/empresas/${id}/send-email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactIds: Array.from(selectedContactIds),
          subject:    emailSubject.trim(),
          body:       emailBody.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al enviar'); return }

      toast.success(`Email enviado a ${json.sent} contacto${json.sent !== 1 ? 's' : ''}`)
      if (json.failed?.length > 0) toast.error(`Fallaron: ${json.failed.join(', ')}`)

      setEmailModalOpen(false)
      clearSelection()
      qc.invalidateQueries({ queryKey: ['empresa-notas', id] })
    } catch { toast.error('Error de conexión') }
    finally { setSendingEmail(false) }
  }

  // Contacts with email (only those can be selected)
  const emailableContacts = (empresa?.contactos ?? []).filter((c: DirectorioContacto) => c.email)
  const selectedCount     = selectedContactIds.size
  const selectedWithEmail = Array.from(selectedContactIds)
    .map(cid => emailableContacts.find((c: DirectorioContacto) => c.id === cid))
    .filter(Boolean) as DirectorioContacto[]

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
    <div className="space-y-6 pb-28">
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
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
              Contactos
              <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full"
                style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                {empresa.contactos?.length ?? 0}
              </span>
            </h2>
            {selectedCount > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: 'var(--color-primary)', color: '#fff' }}>
                <CheckSquare size={11} /> {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedCount > 0 && canSell && (
              <Button size="sm" leftIcon={<Mail size={13} />} onClick={openEmailModal}>
                Enviar Email
              </Button>
            )}
            {canManage && (
              <Button size="sm" onClick={() => setAddContactoOpen(true)}>
                <Plus size={13} /> Agregar contacto
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
                {emailableContacts.length > 0 && canSell && (
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selectedCount > 0 && emailableContacts.every((c: DirectorioContacto) => selectedContactIds.has(c.id))}
                      onChange={e => {
                        if (e.target.checked) setSelectedContactIds(new Set(emailableContacts.map((c: DirectorioContacto) => c.id)))
                        else clearSelection()
                      }}
                      title="Seleccionar todos"
                    />
                  </th>
                )}
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
                  <td colSpan={6} className="px-4 py-10 text-center" style={{ color: 'var(--color-text-muted)' }}>
                    <UserCircle2 size={28} className="mx-auto mb-2 opacity-30" />
                    <p>No hay contactos vinculados aún</p>
                    <p className="text-xs mt-0.5">Podés agregar CEOs, dueños, técnicos, administrativos...</p>
                  </td>
                </tr>
              ) : (
                empresa.contactos.map((c: DirectorioContacto) => {
                  const isSelected = selectedContactIds.has(c.id)
                  const hasEmail   = !!c.email
                  return (
                    <tr key={c.id}
                      className={`transition-colors ${isSelected ? 'bg-[var(--color-primary)]/5' : 'hover:bg-[var(--color-surface-raised)]'}`}
                      style={{ borderBottom: '1px solid var(--color-border)' }}>
                      {emailableContacts.length > 0 && canSell && (
                        <td className="px-3 py-3">
                          {hasEmail ? (
                            <input
                              type="checkbox"
                              className="rounded cursor-pointer"
                              checked={isSelected}
                              onChange={() => toggleContact(c.id)}
                            />
                          ) : (
                            <span className="w-4 h-4 block" />
                          )}
                        </td>
                      )}
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
                          <a href={`https://wa.me/${c.phone.replace(/\D/g, '')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 hover:underline"
                            style={{ color: '#22c55e' }}>
                            <MessageCircle size={12} /> {c.phone}
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
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {emailableContacts.length > 0 && canSell && (
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-subtle)' }}>
            Seleccioná contactos con email para enviarles un mensaje directo.
          </p>
        )}
      </div>

      {/* Floating selection bar */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 gradient-bg rounded-full flex items-center justify-center text-xs font-bold text-white">{selectedCount}</span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                contacto{selectedCount !== 1 ? 's' : ''} seleccionado{selectedCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="w-px h-5" style={{ background: 'var(--color-border)' }} />
            <Button size="sm" leftIcon={<Mail size={13} />} onClick={openEmailModal}>
              Enviar Email
            </Button>
            <button onClick={clearSelection}
              className="p-1.5 rounded-lg hover:bg-[var(--color-surface-raised)] transition-colors"
              style={{ color: 'var(--color-text-muted)' }}>
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Email compose modal */}
      <Modal open={emailModalOpen} onClose={() => setEmailModalOpen(false)} title="Enviar Email" size="md">
        <div className="space-y-4">
          {/* Recipients */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Para:</label>
            <div className="flex flex-wrap gap-2">
              {selectedWithEmail.map(c => (
                <span key={c.id} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full"
                  style={{ background: 'var(--color-primary)', color: '#fff' }}>
                  <Mail size={10} />
                  {c.firstName} {c.lastName}
                  <button onClick={() => toggleContact(c.id)} className="ml-0.5 opacity-70 hover:opacity-100">
                    <X size={10} />
                  </button>
                </span>
              ))}
              {selectedWithEmail.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Seleccioná al menos un contacto con email</p>
              )}
            </div>
          </div>

          <Input
            label="Asunto *"
            placeholder="Ej: Propuesta de mantenimiento preventivo"
            value={emailSubject}
            onChange={e => setEmailSubject(e.target.value)}
          />

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Mensaje *</label>
            <textarea
              rows={7}
              placeholder={`Hola {nombre},\n\nEsperamos que estés muy bien.\n\n...`}
              value={emailBody}
              onChange={e => setEmailBody(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all"
              style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>
              Usá <code className="px-1 rounded text-[11px]" style={{ background: 'var(--color-surface-raised)' }}>{'{nombre}'}</code> para personalizar con el nombre del contacto.
            </p>
          </div>

          <ModalFooter>
            <Button variant="ghost" onClick={() => setEmailModalOpen(false)}>Cancelar</Button>
            <Button
              leftIcon={<Send size={14} />}
              onClick={handleSendEmail}
              loading={sendingEmail}
              disabled={selectedWithEmail.length === 0 || !emailSubject.trim() || !emailBody.trim()}
            >
              Enviar a {selectedWithEmail.length} contacto{selectedWithEmail.length !== 1 ? 's' : ''}
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  )
}
