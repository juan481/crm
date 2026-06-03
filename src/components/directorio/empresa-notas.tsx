'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Phone, Video, Send, ClipboardList } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { timeAgo, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import toast from 'react-hot-toast'

type Tipo = 'NOTA' | 'LLAMADA' | 'REUNION'

interface EmpresaNotaItem {
  id:        string
  tipo:      Tipo
  content:   string
  createdAt: string
  user: { id: string; name: string; avatarUrl: string | null }
}

interface Props {
  empresaId:   string
  empresaNombre?: string
}

const TIPOS: { value: Tipo; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
  {
    value: 'NOTA',
    label: 'Nota',
    icon:  <FileText size={13} />,
    color: 'var(--color-primary)',
    bg:    'var(--color-primary-light, rgba(99,102,241,0.12))',
  },
  {
    value: 'LLAMADA',
    label: 'Llamada',
    icon:  <Phone size={13} />,
    color: '#10b981',
    bg:    'rgba(16,185,129,0.12)',
  },
  {
    value: 'REUNION',
    label: 'Reunión',
    icon:  <Video size={13} />,
    color: '#a855f7',
    bg:    'rgba(168,85,247,0.12)',
  },
]

function tipoMeta(tipo: Tipo) {
  return TIPOS.find(t => t.value === tipo) ?? TIPOS[0]
}

export function EmpresaNotas({ empresaId }: Props) {
  const qc          = useQueryClient()
  const { user }    = useAuthStore()
  const [content, setContent] = useState('')
  const [tipo,    setTipo]    = useState<Tipo>('NOTA')
  const [saving,  setSaving]  = useState(false)

  const { data, isLoading } = useQuery<{ data: EmpresaNotaItem[] }>({
    queryKey: ['empresa-notas', empresaId],
    queryFn: async () => {
      const res = await fetch(`/api/empresas/${empresaId}/notas`)
      if (!res.ok) throw new Error('Error al cargar notas')
      return res.json()
    },
    staleTime: 60_000,
  })

  const notas: EmpresaNotaItem[] = data?.data ?? []

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    // Optimistic insert: append at the top immediately
    const optimisticId = `opt-${Date.now()}`
    const optimistic: EmpresaNotaItem = {
      id:        optimisticId,
      tipo,
      content:   content.trim(),
      createdAt: new Date().toISOString(),
      user: { id: user?.id ?? '', name: user?.name ?? 'Vos', avatarUrl: null },
    }

    qc.setQueryData<{ data: EmpresaNotaItem[] }>(
      ['empresa-notas', empresaId],
      old => ({ data: [optimistic, ...(old?.data ?? [])] })
    )
    setContent('')
    setSaving(true)

    try {
      const res = await fetch(`/api/empresas/${empresaId}/notas`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content: optimistic.content, tipo }),
      })
      const json = await res.json()
      if (!res.ok) {
        // Rollback optimistic entry on error
        qc.setQueryData<{ data: EmpresaNotaItem[] }>(
          ['empresa-notas', empresaId],
          old => ({ data: (old?.data ?? []).filter(n => n.id !== optimisticId) })
        )
        toast.error(json.error ?? 'Error al guardar')
        setContent(optimistic.content)
        return
      }
      // Replace optimistic entry with real one from server
      qc.setQueryData<{ data: EmpresaNotaItem[] }>(
        ['empresa-notas', empresaId],
        old => ({ data: (old?.data ?? []).map(n => n.id === optimisticId ? json.data : n) })
      )
    } catch {
      qc.setQueryData<{ data: EmpresaNotaItem[] }>(
        ['empresa-notas', empresaId],
        old => ({ data: (old?.data ?? []).filter(n => n.id !== optimisticId) })
      )
      toast.error('Error de conexión')
      setContent(optimistic.content)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ClipboardList size={16} style={{ color: 'var(--color-primary)' }} />
        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
          Actividad
        </h2>
        {notas.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
            {notas.length}
          </span>
        )}
      </div>

      {/* Input card */}
      <form
        onSubmit={handleSave}
        className="rounded-2xl p-4 space-y-3"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {/* Type selector */}
        <div className="flex items-center gap-2">
          {TIPOS.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTipo(t.value)}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all"
              style={{
                background: tipo === t.value ? t.bg : 'transparent',
                color:      tipo === t.value ? t.color : 'var(--color-text-muted)',
                border:     `1px solid ${tipo === t.value ? t.color + '40' : 'transparent'}`,
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          rows={2}
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave(e as any)
          }}
          placeholder={
            tipo === 'LLAMADA'  ? 'Resumen de la llamada, temas tratados...' :
            tipo === 'REUNION'  ? 'Acuerdos de la reunión, próximos pasos...' :
                                  'Nota sobre la empresa, observación, seguimiento...'
          }
          className="w-full rounded-xl text-sm resize-none outline-none transition-all px-3 py-2.5"
          style={{
            background:   'var(--color-surface-raised)',
            border:       '1px solid var(--color-border)',
            color:        'var(--color-text)',
          }}
        />

        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Ctrl+Enter para guardar rápido
          </span>
          <Button type="submit" size="sm" disabled={saving || !content.trim()} leftIcon={<Send size={13} />}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </form>

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="flex gap-3">
              <div className="w-7 h-7 rounded-full animate-pulse shrink-0" style={{ background: 'var(--color-border)' }} />
              <div className="flex-1 space-y-1.5 pt-1">
                <div className="h-3 w-32 rounded animate-pulse" style={{ background: 'var(--color-border)' }} />
                <div className="h-3 w-full rounded animate-pulse" style={{ background: 'var(--color-border)' }} />
              </div>
            </div>
          ))}
        </div>
      ) : notas.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
          Aún no hay actividad registrada. Agregá la primera nota.
        </p>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div
            className="absolute left-[13px] top-3 bottom-3 w-px"
            style={{ background: 'var(--color-border)' }}
          />

          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {notas.map(nota => {
                const meta = tipoMeta(nota.tipo)
                return (
                  <motion.li
                    key={nota.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="flex gap-3 relative"
                  >
                    {/* Type dot */}
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10"
                      style={{ background: meta.bg, color: meta.color, border: `1.5px solid ${meta.color}40` }}
                    >
                      {meta.icon}
                    </div>

                    {/* Content */}
                    <div
                      className="flex-1 rounded-xl px-3 py-2.5 mb-1"
                      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className="text-xs font-semibold"
                          style={{ color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        <Avatar name={nota.user.name} src={nota.user.avatarUrl ?? undefined} size="xs" />
                        <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                          {nota.user.name}
                        </span>
                        <span
                          className="text-xs ml-auto"
                          style={{ color: 'var(--color-text-muted)' }}
                          title={formatDate(nota.createdAt)}
                        >
                          {timeAgo(nota.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-muted)' }}>
                        {nota.content}
                      </p>
                    </div>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </div>
  )
}
