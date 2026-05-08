'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Mail, Phone, MessageCircle, User, Briefcase } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Modal } from '@/components/ui/modal'
import type { Contact } from '@/types'
import toast from 'react-hot-toast'

interface ContactsManagerProps {
  clientId: string
  contacts: Contact[]
  onUpdate: () => void
}

interface ContactFormState {
  name: string
  email: string
  phone: string
  whatsapp: string
  role: string
}

const EMPTY_FORM: ContactFormState = { name: '', email: '', phone: '', whatsapp: '', role: '' }

export function ContactsManager({ clientId, contacts, onUpdate }: ContactsManagerProps) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ContactFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          whatsapp: form.whatsapp.trim() || null,
          role: form.role.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success('Contacto agregado')
      setForm(EMPTY_FORM)
      setShowForm(false)
      onUpdate()
      qc.invalidateQueries({ queryKey: ['client', clientId] })
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/contacts?contactId=${deleteTarget.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success('Contacto eliminado')
      setDeleteTarget(null)
      onUpdate()
      qc.invalidateQueries({ queryKey: ['client', clientId] })
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  const field = (key: keyof ContactFormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-muted)]">
          {contacts.length === 0 ? 'Sin contactos registrados' : `${contacts.length} contacto${contacts.length !== 1 ? 's' : ''}`}
        </p>
        <Button size="sm" variant="secondary" leftIcon={<Plus size={14} />} onClick={() => setShowForm(true)}>
          Agregar
        </Button>
      </div>

      {/* Contacts list */}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {contacts.map((contact) => (
            <motion.div
              key={contact.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="surface rounded-xl p-3 flex items-start gap-3 group"
            >
              <Avatar name={contact.name} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-[var(--color-text)]">{contact.name}</span>
                  {contact.role && (
                    <span className="text-xs text-[var(--color-text-subtle)] flex items-center gap-1">
                      <Briefcase size={10} />
                      {contact.role}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] flex items-center gap-1 transition-colors">
                      <Mail size={11} />{contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] flex items-center gap-1 transition-colors">
                      <Phone size={11} />{contact.phone}
                    </a>
                  )}
                  {contact.whatsapp && (
                    <a
                      href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-500 hover:text-green-400 flex items-center gap-1 transition-colors"
                    >
                      <MessageCircle size={11} />{contact.whatsapp}
                    </a>
                  )}
                </div>
              </div>
              <button
                onClick={() => setDeleteTarget(contact)}
                className="opacity-0 group-hover:opacity-100 text-[var(--color-text-subtle)] hover:text-red-400 transition-all p-1 rounded"
                title="Eliminar contacto"
              >
                <Trash2 size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add contact modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Agregar Contacto" size="sm">
        <form onSubmit={handleAdd} className="space-y-3">
          <Input
            label="Nombre *"
            placeholder="Juan García"
            leftIcon={<User size={14} />}
            {...field('name')}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Email"
              type="email"
              placeholder="juan@empresa.com"
              leftIcon={<Mail size={14} />}
              {...field('email')}
            />
            <Input
              label="Cargo / Rol"
              placeholder="CEO, CTO..."
              leftIcon={<Briefcase size={14} />}
              {...field('role')}
            />
            <Input
              label="Teléfono"
              placeholder="+54 11 1234 5678"
              leftIcon={<Phone size={14} />}
              {...field('phone')}
            />
            <Input
              label="WhatsApp"
              placeholder="+54 9 11 1234 5678"
              leftIcon={<MessageCircle size={14} />}
              {...field('whatsapp')}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Agregar Contacto</Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar Contacto" size="sm">
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          ¿Eliminar a <strong className="text-[var(--color-text)]">{deleteTarget?.name}</strong>? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  )
}
