'use client'

import { useEffect, useRef, useState } from 'react'
import { UploadCloud, Link2, MessageCircle, Ban, AlignLeft, AlignCenter, AlignRight, Loader2 } from 'lucide-react'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

export type ImgAlign = 'left' | 'center' | 'right'
export interface ImageLinkResult {
  src: string
  align: ImgAlign
  href: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (r: ImageLinkResult) => void
  /** Sólo en modo edición: quitar la imagen del contenido. */
  onRemove?: () => void
  /** Presente = modo edición (click sobre una imagen ya insertada). */
  initial?: Partial<ImageLinkResult> & { waNumber?: string; waMessage?: string; linkUrl?: string }
}

// ── Compresión en el navegador ───────────────────────────────────────────────
// Buena calidad, poco peso: se redimensiona a MAX_PX en el lado más largo
// (suficiente para retina a ~600px de ancho de email) y se baja la calidad
// JPEG en escalones hasta quedar bajo el objetivo de peso.
const MAX_PX = 1000
const TARGET_BYTES = 200 * 1024
const HARD_CAP_BYTES = 260 * 1024

async function compressImage(file: File): Promise<Blob> {
  // GIF: probablemente animado — el canvas lo aplanaría. Se sube tal cual.
  if (file.type === 'image/gif') return file

  const img = document.createElement('img')
  const objectUrl = URL.createObjectURL(file)
  try {
    img.src = objectUrl
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('load')) })

    const ratio = Math.min(1, MAX_PX / img.naturalWidth, MAX_PX / img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio))
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff' // fondo blanco para PNG con transparencia (el mail no muestra alpha bien igual)
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    let blob: Blob | null = null
    for (const q of [0.82, 0.72, 0.62, 0.5]) {
      blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', q))
      if (blob && blob.size <= (q === 0.82 ? TARGET_BYTES : HARD_CAP_BYTES)) break
    }
    if (!blob) throw new Error('encode')
    return blob
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

// Deja un número listo para wa.me: sólo dígitos, sin +, sin 00 inicial.
function toWaDigits(raw: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  return d
}
function buildWaHref(number: string, message: string): string | null {
  const d = toWaDigits(number)
  if (d.length < 8) return null
  const base = `https://wa.me/${d}`
  return message.trim() ? `${base}?text=${encodeURIComponent(message.trim())}` : base
}

type ClickMode = 'none' | 'link' | 'whatsapp'

export function ImageLinkModal({ open, onClose, onSubmit, onRemove, initial }: Props) {
  const isEdit = !!initial?.src
  const fileRef = useRef<HTMLInputElement>(null)

  const [src, setSrc] = useState('')
  const [urlDraft, setUrlDraft] = useState('')
  const [align, setAlign] = useState<ImgAlign>('center')
  const [mode, setMode] = useState<ClickMode>('none')
  const [linkUrl, setLinkUrl] = useState('')
  const [waNumber, setWaNumber] = useState('')
  const [waMessage, setWaMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // Reset / precarga cada vez que se abre
  useEffect(() => {
    if (!open) return
    setSrc(initial?.src ?? '')
    setUrlDraft('')
    setAlign(initial?.align ?? 'center')
    setWaNumber(initial?.waNumber ?? '')
    setWaMessage(initial?.waMessage ?? '')
    setLinkUrl(initial?.linkUrl ?? '')
    setMode(initial?.waNumber ? 'whatsapp' : initial?.linkUrl ? 'link' : 'none')
    setUploading(false)
    setDragOver(false)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Elegí una imagen'); return }
    setUploading(true)
    try {
      const blob = await compressImage(file)
      const fd = new FormData()
      const ext = blob.type === 'image/gif' ? 'gif' : 'jpg'
      fd.append('file', new File([blob], `img.${ext}`, { type: blob.type }))
      const res = await fetch('/api/email-images/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'No se pudo subir la imagen'); return }
      setSrc(json.data.url)
      const kb = Math.round(blob.size / 1024)
      toast.success(`Imagen lista (${kb} KB)`)
    } catch {
      toast.error('No se pudo procesar la imagen')
    } finally {
      setUploading(false)
    }
  }

  const waHref = buildWaHref(waNumber, waMessage)
  const finalHref =
    mode === 'whatsapp' ? waHref :
    mode === 'link' ? (linkUrl.trim() ? (/^https?:\/\//i.test(linkUrl.trim()) ? linkUrl.trim() : `https://${linkUrl.trim()}`) : null) :
    null

  const canSubmit = !!src && (mode === 'none' || !!finalHref)

  const submit = () => {
    if (!src) { toast.error('Falta la imagen'); return }
    if (mode === 'whatsapp' && !waHref) { toast.error('Revisá el número de WhatsApp'); return }
    if (mode === 'link' && !finalHref) { toast.error('Falta la URL del enlace'); return }
    onSubmit({ src, align, href: finalHref })
    onClose()
  }

  const alignBtn = (value: ImgAlign, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => setAlign(value)}
      title={label}
      className={cn(
        'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-colors',
        align === value
          ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]'
          : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]',
      )}
    >
      {icon}<span className="hidden sm:inline">{label}</span>
    </button>
  )

  const modeBtn = (value: ClickMode, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      className={cn(
        'flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[11px] font-medium transition-colors',
        mode === value
          ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]'
          : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]',
      )}
    >
      {icon}{label}
    </button>
  )

  const inputCls = 'w-full rounded-xl px-3 py-2 text-sm outline-none bg-[var(--color-surface)] border border-[var(--color-border-strong)] text-[var(--color-text)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)]'

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar imagen' : 'Insertar imagen'} size="md">
      <div className="space-y-4">
        {/* Fuente de la imagen */}
        {!src ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }}
            className={cn(
              'rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',
              dragOver ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]' : 'border-[var(--color-border-strong)]',
            )}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2 text-sm text-[var(--color-text-muted)]">
                <Loader2 size={20} className="animate-spin" /> Procesando…
              </div>
            ) : (
              <>
                <UploadCloud size={22} className="mx-auto mb-2 text-[var(--color-text-subtle)]" />
                <p className="text-sm text-[var(--color-text)]">
                  Arrastrá una imagen o{' '}
                  <button type="button" onClick={() => fileRef.current?.click()} className="text-[var(--color-primary)] font-medium underline">
                    elegí un archivo
                  </button>
                </p>
                <p className="text-[11px] text-[var(--color-text-subtle)] mt-1">
                  Se comprime sola a ~1000px y &lt;200 KB. JPG, PNG, WEBP o GIF.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={urlDraft}
                    onChange={(e) => setUrlDraft(e.target.value)}
                    placeholder="…o pegá la URL de una imagen"
                    className={inputCls}
                  />
                  <Button type="button" variant="secondary" size="sm" disabled={!/^https?:\/\//i.test(urlDraft.trim())} onClick={() => setSrc(urlDraft.trim())}>
                    Usar
                  </Button>
                </div>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
            <div className="bg-[var(--color-surface-raised)] p-3 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="max-h-40 max-w-full object-contain rounded" />
            </div>
            <button type="button" onClick={() => { setSrc(''); setUrlDraft('') }} className="w-full py-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] border-t border-[var(--color-border)]">
              Cambiar imagen
            </button>
          </div>
        )}

        {/* Alineación */}
        <div>
          <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Alineación</p>
          <div className="flex gap-2">
            {alignBtn('left', <AlignLeft size={14} />, 'Izquierda')}
            {alignBtn('center', <AlignCenter size={14} />, 'Centro')}
            {alignBtn('right', <AlignRight size={14} />, 'Derecha')}
          </div>
        </div>

        {/* Al hacer click */}
        <div>
          <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Al hacer click en la imagen</p>
          <div className="flex gap-2">
            {modeBtn('none', <Ban size={15} />, 'Nada')}
            {modeBtn('link', <Link2 size={15} />, 'Abrir link')}
            {modeBtn('whatsapp', <MessageCircle size={15} />, 'WhatsApp')}
          </div>

          {mode === 'link' && (
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://abbaseguridad.com.ar"
              className={cn(inputCls, 'mt-2')}
            />
          )}

          {mode === 'whatsapp' && (
            <div className="mt-2 space-y-2">
              <input
                value={waNumber}
                onChange={(e) => setWaNumber(e.target.value)}
                placeholder="Número con código de país — ej. 54 9 2302 20 1201"
                className={inputCls}
              />
              <input
                value={waMessage}
                onChange={(e) => setWaMessage(e.target.value)}
                placeholder="Mensaje pre-cargado (opcional) — ej. Hola, quiero información"
                className={inputCls}
              />
              <p className="text-[11px] text-[var(--color-text-subtle)] break-all">
                {waHref ? <>Se abrirá: <span className="text-[var(--color-text-muted)]">{waHref}</span></> : 'Poné el número completo con código de país (sin el +).'}
              </p>
            </div>
          )}
        </div>
      </div>

      <ModalFooter>
        {isEdit && onRemove && (
          <button
            type="button"
            onClick={() => { onRemove(); onClose() }}
            className="mr-auto text-xs font-medium text-red-500 hover:text-red-600"
          >
            Quitar imagen
          </button>
        )}
        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="button" onClick={submit} disabled={!canSubmit || uploading}>
          {isEdit ? 'Guardar' : 'Insertar'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
