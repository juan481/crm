'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, FileText, Pencil, Trash2, Eye, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import type { EmailTemplate } from '@/types'
import toast from 'react-hot-toast'

interface TemplateFormState {
  name: string
  subject: string
  body: string
}

const EMPTY: TemplateFormState = { name: '', subject: '', body: '' }

export function TemplateManager() {
  const qc = useQueryClient()
  const [formOpen, setFormOpen]   = useState(false)
  const [editing, setEditing]     = useState<EmailTemplate | null>(null)
  const [previewing, setPreviewing] = useState<EmailTemplate | null>(null)
  const [form, setForm]           = useState<TemplateFormState>(EMPTY)
  const [saving, setSaving]       = useState(false)

  const { data, isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const res = await fetch('/api/email-templates')
      const json = await res.json()
      return json.data ?? []
    },
  })

  const templates = data ?? []

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setFormOpen(true)
  }

  const openEdit = (t: EmailTemplate) => {
    setEditing(t)
    setForm({ name: t.name, subject: t.subject, body: t.body })
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) {
      toast.error('Completá todos los campos')
      return
    }
    setSaving(true)
    try {
      const url    = editing ? `/api/email-templates/${editing.id}` : '/api/email-templates'
      const method = editing ? 'PATCH' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success(editing ? 'Plantilla actualizada' : 'Plantilla creada')
      setFormOpen(false)
      qc.invalidateQueries({ queryKey: ['email-templates'] })
    } catch { toast.error('Error') } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/email-templates/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Plantilla eliminada')
      qc.invalidateQueries({ queryKey: ['email-templates'] })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-[var(--color-primary)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Plantillas de Email</h2>
          <span className="text-xs text-[var(--color-text-subtle)] bg-[var(--color-surface-raised)] px-2 py-0.5 rounded-full">{templates.length}</span>
        </div>
        <Button size="sm" leftIcon={<Plus size={14} />} onClick={openCreate}>
          Nueva plantilla
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="surface rounded-2xl p-8 text-center">
          <FileText size={28} className="mx-auto mb-2 text-[var(--color-text-subtle)] opacity-50" />
          <p className="text-sm text-[var(--color-text-muted)]">Sin plantillas aún</p>
          <p className="text-xs text-[var(--color-text-subtle)] mt-1">
            Creá plantillas reutilizables para tus campañas
          </p>
          <Button size="sm" className="mt-4" leftIcon={<Plus size={14} />} onClick={openCreate}>
            Crear primera plantilla
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div
              key={t.id}
              className="list-appear surface rounded-xl px-4 py-3 flex items-center gap-3 group"
            >
              <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
                <FileText size={15} className="text-[var(--color-primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text)] truncate">{t.name}</p>
                <p className="text-xs text-[var(--color-text-muted)] truncate">{t.subject}</p>
              </div>
              <span className="hidden sm:block text-[10px] text-[var(--color-text-subtle)] shrink-0">
                {formatDate(t.updatedAt)}
              </span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setPreviewing(t)}
                  className="p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-all"
                  title="Vista previa"
                >
                  <Eye size={14} />
                </button>
                <button
                  onClick={() => openEdit(t)}
                  className="p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-all"
                  title="Editar"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Eliminar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar Plantilla' : 'Nueva Plantilla'}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Nombre de la plantilla"
            placeholder="Ej: Bienvenida, Renovación, Novedades..."
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Asunto del email"
            placeholder="Asunto que verá el destinatario"
            value={form.subject}
            onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
          />
          <Textarea
            label="Cuerpo del email"
            placeholder="Escribí el contenido. Podés usar {{nombre}} para personalizar."
            rows={8}
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
          />
          <div className="flex items-start gap-2 p-3 bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15 rounded-xl">
            <span className="text-[var(--color-primary)] text-xs shrink-0 mt-0.5">💡</span>
            <p className="text-xs text-[var(--color-text-muted)]">
              Usá <code className="text-[var(--color-primary)] font-mono bg-[var(--color-primary)]/10 px-1 rounded">{'{{nombre}}'}</code> para insertar el nombre del destinatario automáticamente.
            </p>
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? 'Guardar cambios' : 'Crear plantilla'}
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      {/* Preview modal */}
      <Modal
        open={!!previewing}
        onClose={() => setPreviewing(null)}
        title="Vista previa de plantilla"
        size="md"
      >
        {previewing && (
          <div className="space-y-4">
            <div className="p-3 surface-raised rounded-xl">
              <p className="text-xs text-[var(--color-text-subtle)] mb-0.5">Asunto</p>
              <p className="text-sm font-medium text-[var(--color-text)]">{previewing.subject}</p>
            </div>
            <div className="p-4 surface-raised rounded-xl">
              <p className="text-xs text-[var(--color-text-subtle)] mb-2">Cuerpo</p>
              <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap leading-relaxed">{previewing.body}</p>
            </div>
            <ModalFooter>
              <Button variant="ghost" onClick={() => setPreviewing(null)} leftIcon={<X size={14} />}>Cerrar</Button>
              <Button onClick={() => { setPreviewing(null); openEdit(previewing) }} leftIcon={<Pencil size={14} />}>
                Editar
              </Button>
            </ModalFooter>
          </div>
        )}
      </Modal>
    </div>
  )
}
