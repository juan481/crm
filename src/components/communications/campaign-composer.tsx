'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { Users, Send, Save } from 'lucide-react'
import { Input, Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ModalFooter } from '@/components/ui/modal'
import type { Client } from '@/types'
import toast from 'react-hot-toast'

const schema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  subject: z.string().min(3, 'Asunto requerido'),
  body: z.string().min(10, 'El cuerpo del email es muy corto'),
})
type FormData = z.infer<typeof schema>

interface CampaignComposerProps {
  onSuccess: () => void
  onCancel: () => void
}

export function CampaignComposer({ onSuccess, onCancel }: CampaignComposerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sendNow, setSendNow] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { data: clientsData } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const res = await fetch('/api/clients?limit=100&status=ACTIVE')
      const json = await res.json()
      return json.data as Client[]
    },
  })

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const clients = clientsData ?? []
  const allSelected = clients.length > 0 && selectedIds.size === clients.length

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(clients.map((c) => c.id)))
  }

  const toggleClient = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/communications/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          recipientIds: Array.from(selectedIds),
          sendNow,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success(sendNow ? 'Campaña enviada exitosamente' : 'Campaña guardada como borrador')
      onSuccess()
    } catch {
      toast.error('Error al crear campaña')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Nombre de la campaña"
          placeholder="Campaña Mayo 2026"
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="Asunto del email"
          placeholder="¡Tenemos novedades para ti!"
          error={errors.subject?.message}
          {...register('subject')}
        />
      </div>

      <Textarea
        label="Cuerpo del email"
        placeholder="Escribe el contenido de tu email aquí..."
        rows={6}
        error={errors.body?.message}
        {...register('body')}
      />

      {/* Recipient selector */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-[var(--color-text-muted)]">
            Destinatarios ({selectedIds.size} seleccionados)
          </label>
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs text-[var(--color-primary)] hover:underline"
          >
            {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
          </button>
        </div>
        <div className="surface-raised rounded-xl max-h-48 overflow-y-auto divide-y divide-[var(--color-border)]">
          {clients.length === 0 ? (
            <p className="p-4 text-sm text-[var(--color-text-muted)] text-center">
              No hay clientes activos
            </p>
          ) : (
            clients.map((client) => (
              <label
                key={client.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-surface-overlay)] cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(client.id)}
                  onChange={() => toggleClient(client.id)}
                  className="w-4 h-4 accent-[var(--color-primary)] rounded"
                />
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">{client.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{client.email}</p>
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      <ModalFooter className="flex-col sm:flex-row items-start sm:items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer mr-auto">
          <input
            type="checkbox"
            checked={sendNow}
            onChange={(e) => setSendNow(e.target.checked)}
            className="w-4 h-4 accent-[var(--color-primary)] rounded"
          />
          <span className="text-sm text-[var(--color-text-muted)]">Enviar ahora</span>
        </label>
        <Button variant="ghost" onClick={onCancel} type="button">Cancelar</Button>
        <Button
          type="submit"
          loading={submitting}
          leftIcon={sendNow ? <Send size={15} /> : <Save size={15} />}
        >
          {sendNow ? 'Enviar Campaña' : 'Guardar Borrador'}
        </Button>
      </ModalFooter>
    </form>
  )
}
