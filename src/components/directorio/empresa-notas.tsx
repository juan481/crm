'use client'

import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Phone, Video, Send, ClipboardList, MessageCircle,
  Headphones, Clock, X, Paperclip, Trash2,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { timeAgo, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import toast from 'react-hot-toast'

type Tipo = 'NOTA' | 'LLAMADA' | 'REUNION' | 'CHAT' | 'ENVIO_COTIZACION' | 'CONVERSACION' | 'SOPORTE'

interface EmpresaNotaItem {
  id:               string
  tipo:             Tipo
  content:          string
  estimatedMinutes: number
  metadata?:        string | null
  createdAt:        string
  user: { id: string; name: string; avatarUrl: string | null }
}

interface Props {
  empresaId:    string
  empresaNombre?: string
}

// ── Tipo metadata ──────────────────────────────────────────────────────────

const TIPO_META: Record<Tipo, { label: string; icon: React.ReactNode; color: string; bg: string; placeholder: string; defaultMinutes: number }> = {
  NOTA: {
    label: 'Nota', icon: <FileText size={13} />, color: 'var(--color-primary)', bg: 'var(--color-primary-light, rgba(99,102,241,0.12))',
    placeholder: 'Nota sobre la empresa, observación, seguimiento...', defaultMinutes: 0,
  },
  LLAMADA: {
    label: 'Llamada', icon: <Phone size={13} />, color: '#10b981', bg: 'rgba(16,185,129,0.12)',
    placeholder: 'Resumen de la llamada, temas tratados, próximos pasos...', defaultMinutes: 5,
  },
  REUNION: {
    label: 'Reunión', icon: <Video size={13} />, color: '#a855f7', bg: 'rgba(168,85,247,0.12)',
    placeholder: 'Acuerdos de la reunión, decisiones tomadas, compromisos...', defaultMinutes: 45,
  },
  CHAT: {
    label: 'Chat', icon: <MessageCircle size={13} />, color: '#14b8a6', bg: 'rgba(20,184,166,0.12)',
    placeholder: 'Resumen del chat (WhatsApp, Telegram, etc.)...', defaultMinutes: 5,
  },
  ENVIO_COTIZACION: {
    label: 'Envío Cotización', icon: <Send size={13} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',
    placeholder: 'Detalle de la cotización enviada, servicios incluidos, valor total...', defaultMinutes: 10,
  },
  CONVERSACION: {
    label: 'Conversación', icon: <ClipboardList size={13} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',
    placeholder: 'Resumen de la conversación, puntos clave tratados...', defaultMinutes: 30,
  },
  SOPORTE: {
    label: 'Soporte', icon: <Headphones size={13} />, color: '#ef4444', bg: 'rgba(239,68,68,0.12)',
    placeholder: 'Descripción del problema, pasos realizados, resolución...', defaultMinutes: 10,
  },
}

const TYPE_OPTIONS = (Object.entries(TIPO_META) as [Tipo, typeof TIPO_META[Tipo]][]).map(([value, m]) => ({
  value,
  label: m.label,
}))

function parseMeta(raw: string | null | undefined): { imageUrl?: string } | null {
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

// ── Component ──────────────────────────────────────────────────────────────

export function EmpresaNotas({ empresaId }: Props) {
  const qc       = useQueryClient()
  const { user } = useAuthStore()

  const [content,   setContent]   = useState('')
  const [tipo,      setTipo]      = useState<Tipo>('NOTA')
  const [minutes,   setMinutes]   = useState(0)
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

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

  const handleDelete = async (notaId: string) => {
    if (!confirm('¿Eliminar esta nota?')) return
    setDeleting(notaId)
    try {
      const res = await fetch(`/api/empresas/${empresaId}/notas/${notaId}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        toast.error(json.error ?? 'Error al eliminar')
        return
      }
      qc.setQueryData<{ data: EmpresaNotaItem[] }>(
        ['empresa-notas', empresaId],
        old => ({ data: (old?.data ?? []).filter(n => n.id !== notaId) })
      )
      toast.success('Nota eliminada')
    } catch {
      toast.error('Error de conexión')
    } finally {
      setDeleting(null)
    }
  }

  const handleTipoChange = (newTipo: Tipo) => {
    setTipo(newTipo)
    setMinutes(TIPO_META[newTipo].defaultMinutes)
  }

  // Image paste handler for contentEditable
  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find(i => i.type.startsWith('image/'))
    if (!imageItem) return
    e.preventDefault()
    const file = imageItem.getAsFile()
    if (!file) return
    setImageFile(file)
    toast.success('Imagen adjuntada. Se subirá al guardar.')
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = contentRef.current?.innerText?.trim() ?? content.trim()
    if (!text) return

    let imageUrl: string | undefined
    if (imageFile) {
      setUploading(true)
      try {
        const fd = new FormData()
        fd.append('file', imageFile)
        const upRes  = await fetch('/api/documentos/upload', { method: 'POST', body: fd })
        const upJson = await upRes.json()
        if (!upRes.ok) { toast.error(upJson.error ?? 'Error al subir imagen'); setUploading(false); return }
        imageUrl = upJson.data.url
      } catch {
        toast.error('Error al subir imagen')
        setUploading(false)
        return
      }
      setUploading(false)
    }

    const meta = imageUrl ? JSON.stringify({ imageUrl }) : undefined

    // Optimistic insert
    const optimisticId = `opt-${Date.now()}`
    const optimistic: EmpresaNotaItem = {
      id:               optimisticId,
      tipo,
      content:          text,
      estimatedMinutes: minutes,
      metadata:         meta ?? null,
      createdAt:        new Date().toISOString(),
      user: { id: user?.id ?? '', name: user?.name ?? 'Vos', avatarUrl: null },
    }

    qc.setQueryData<{ data: EmpresaNotaItem[] }>(
      ['empresa-notas', empresaId],
      old => ({ data: [optimistic, ...(old?.data ?? [])] })
    )
    setContent('')
    if (contentRef.current) contentRef.current.innerText = ''
    setImageFile(null)
    setSaving(true)

    try {
      const res = await fetch(`/api/empresas/${empresaId}/notas`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content: text, tipo, estimatedMinutes: minutes, metadata: meta }),
      })
      const json = await res.json()
      if (!res.ok) {
        qc.setQueryData<{ data: EmpresaNotaItem[] }>(
          ['empresa-notas', empresaId],
          old => ({ data: (old?.data ?? []).filter(n => n.id !== optimisticId) })
        )
        toast.error(json.error ?? 'Error al guardar')
        setContent(text)
        if (contentRef.current) contentRef.current.innerText = text
        return
      }
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
      setContent(text)
      if (contentRef.current) contentRef.current.innerText = text
    } finally {
      setSaving(false)
    }
  }

  const meta = TIPO_META[tipo]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ClipboardList size={16} style={{ color: 'var(--color-primary)' }} />
        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Actividad</h2>
        {notas.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
            {notas.length}
          </span>
        )}
      </div>

      {/* ── Input card ────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSave}
        className="rounded-2xl p-4 space-y-3"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {/* Type selector (now a Select dropdown) */}
        <Select
          options={TYPE_OPTIONS}
          value={tipo}
          onChange={e => handleTipoChange(e.target.value as Tipo)}
        />

        {/* Content area (contentEditable for paste support) */}
        <div
          ref={contentRef}
          contentEditable
          suppressContentEditableWarning
          onInput={e => setContent((e.target as HTMLDivElement).innerText)}
          onPaste={handlePaste}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave(e as any)
          }}
          data-placeholder={meta.placeholder}
          className="w-full rounded-xl text-sm outline-none transition-all px-3 py-2.5 min-h-[72px] leading-relaxed"
          style={{
            background:  'var(--color-surface-raised)',
            border:      '1px solid var(--color-border)',
            color:       'var(--color-text)',
          }}
        />

        {/* Image attachment indicator */}
        {imageFile && (
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
            <Paperclip size={12} className="shrink-0" />
            <span className="flex-1 truncate">{imageFile.name}</span>
            <button type="button" onClick={() => setImageFile(null)} className="text-red-400 hover:text-red-300 transition-colors">
              <X size={13} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          {/* Duration field + attach button */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Clock size={12} style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="number"
                min="0"
                max="999"
                value={minutes}
                onChange={e => setMinutes(Number(e.target.value))}
                className="w-14 text-xs text-center rounded-lg px-2 py-1 outline-none"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                title="Duración estimada en minutos"
              />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>min</span>
            </div>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
              style={{ color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)' }}
              title="Adjuntar imagen"
            >
              <Paperclip size={11} />
              Imagen
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => setImageFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs hidden sm:block" style={{ color: 'var(--color-text-muted)' }}>Ctrl+Enter para guardar</span>
            <Button type="submit" size="sm" disabled={saving || uploading || !content.trim()} leftIcon={<Send size={13} />}>
              {saving || uploading ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </form>

      {/* ── Timeline ──────────────────────────────────────────────────────── */}
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
          <div className="absolute left-[13px] top-3 bottom-3 w-px" style={{ background: 'var(--color-border)' }} />
          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {notas.map(nota => {
                const m   = TIPO_META[nota.tipo] ?? TIPO_META.NOTA
                const img = parseMeta(nota.metadata)?.imageUrl
                return (
                  <motion.li
                    key={nota.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="flex gap-3 relative group/nota"
                  >
                    {/* Type dot */}
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10"
                      style={{ background: m.bg, color: m.color, border: `1.5px solid ${m.color}40` }}
                    >
                      {m.icon}
                    </div>

                    {/* Content */}
                    <div
                      className="flex-1 rounded-xl px-3 py-2.5 mb-1"
                      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-semibold" style={{ color: m.color }}>{m.label}</span>
                        {nota.estimatedMinutes > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-subtle)' }}>
                            <Clock size={9} />
                            {nota.estimatedMinutes} min
                          </span>
                        )}
                        <Avatar name={nota.user.name} src={nota.user.avatarUrl ?? undefined} size="xs" />
                        <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>{nota.user.name}</span>
                        <span className="text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }} title={formatDate(nota.createdAt)}>
                          {timeAgo(nota.createdAt)}
                        </span>
                        {(nota.user.id === user?.id || ['ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '')) && (
                          <button
                            type="button"
                            onClick={() => handleDelete(nota.id)}
                            disabled={deleting === nota.id}
                            className="opacity-0 group-hover/nota:opacity-100 ml-1 p-1 rounded transition-all hover:text-red-400 disabled:opacity-40"
                            style={{ color: 'var(--color-text-subtle)' }}
                            title="Eliminar nota"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>

                      <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-muted)' }}>
                        {nota.content}
                      </p>

                      {/* Attached image */}
                      {img && (
                        <div className="mt-2">
                          <a href={img} target="_blank" rel="noopener noreferrer">
                            <img
                              src={img}
                              alt="Captura adjunta"
                              className="max-h-48 rounded-lg border object-cover hover:opacity-90 transition-opacity cursor-zoom-in"
                              style={{ borderColor: 'var(--color-border)' }}
                            />
                          </a>
                        </div>
                      )}
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
