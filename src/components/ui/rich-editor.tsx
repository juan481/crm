'use client'

import { useRef, useCallback, useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import {
  Bold, Italic, Underline, List, ListOrdered,
  Link2, AlignLeft, AlignCenter, AlignRight,
  Minus, Image as ImageIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ImageLinkModal, type ImageLinkResult } from '@/components/ui/image-link-modal'

// Estilo del <img> dentro del mail — inline-block para que el text-align del
// contenedor lo alinee bien en Gmail/Outlook/Apple Mail (un block ignora el
// text-align del padre).
const IMG_STYLE = 'max-width:100%;height:auto;display:inline-block;vertical-align:top;border-radius:8px;'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildImageHtml(r: ImageLinkResult): string {
  const img = `<img src="${esc(r.src)}" alt="" style="${IMG_STYLE}" />`
  const inner = r.href
    ? `<a href="${esc(r.href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;">${img}</a>`
    : img
  return `<div class="rt-img" style="text-align:${r.align};margin:14px 0;">${inner}</div>`
}

// Lee el estado de una imagen ya insertada (para abrir el modal en modo edición).
function readImageState(imgEl: HTMLImageElement) {
  const box = imgEl.closest('.rt-img') as HTMLElement | null
  const anchor = imgEl.closest('a')
  const align = ((box?.style.textAlign as 'left' | 'center' | 'right') || 'center')
  const href = anchor?.getAttribute('href') || ''
  let waNumber = '', waMessage = '', linkUrl = ''
  if (/^https?:\/\/wa\.me\//i.test(href)) {
    try {
      const u = new URL(href)
      waNumber = u.pathname.replace(/\//g, '')
      waMessage = u.searchParams.get('text') || ''
    } catch { /* noop */ }
  } else if (href) {
    linkUrl = href
  }
  return { el: box ?? anchor ?? imgEl, src: imgEl.getAttribute('src') || '', align, waNumber, waMessage, linkUrl }
}

export interface RichEditorHandle {
  getHTML: () => string
  getText: () => string
  setHTML: (html: string) => void
  clear: () => void
}

interface RichEditorProps {
  placeholder?: string
  minHeight?: number
  className?: string
  /** HTML inicial (modo edición). Se aplica una sola vez al montar. */
  initialHTML?: string
  onChange?: (html: string) => void
}

const TOOLBAR = [
  [
    { cmd: 'bold',          icon: <Bold size={14} />,         title: 'Negrita (Ctrl+B)' },
    { cmd: 'italic',        icon: <Italic size={14} />,       title: 'Cursiva (Ctrl+I)' },
    { cmd: 'underline',     icon: <Underline size={14} />,    title: 'Subrayado (Ctrl+U)' },
  ],
  [
    { cmd: 'insertUnorderedList', icon: <List size={14} />,        title: 'Lista' },
    { cmd: 'insertOrderedList',   icon: <ListOrdered size={14} />, title: 'Lista numerada' },
  ],
  [
    { cmd: 'justifyLeft',   icon: <AlignLeft size={14} />,    title: 'Alinear izquierda' },
    { cmd: 'justifyCenter', icon: <AlignCenter size={14} />,  title: 'Centrar' },
    { cmd: 'justifyRight',  icon: <AlignRight size={14} />,   title: 'Alinear derecha' },
  ],
]

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(
  function RichEditor({ placeholder = 'Escribí el contenido del email...', minHeight = 220, className, initialHTML, onChange }, ref) {
    const editorRef = useRef<HTMLDivElement>(null)
    // Selección guardada antes de abrir el modal (se pierde el foco del editor).
    const savedRange = useRef<Range | null>(null)
    // Nodo de la imagen que se está editando (null = insertar una nueva).
    const editingEl = useRef<HTMLElement | null>(null)
    // Prefill del HTML inicial — una sola vez por montaje. Después, el propio
    // contentEditable es la fuente de verdad (si React lo re-pisara borraría lo
    // que el usuario escribió).
    const prefilled = useRef(false)

    useEffect(() => {
      if (prefilled.current || !editorRef.current) return
      if (initialHTML) editorRef.current.innerHTML = initialHTML
      prefilled.current = true
    }, [initialHTML])

    const [imgModalOpen, setImgModalOpen] = useState(false)
    const [imgInitial, setImgInitial] = useState<Parameters<typeof ImageLinkModal>[0]['initial']>(undefined)

    useImperativeHandle(ref, () => ({
      getHTML: () => editorRef.current?.innerHTML ?? '',
      getText: () => editorRef.current?.innerText ?? '',
      setHTML: (html: string) => { if (editorRef.current) editorRef.current.innerHTML = html },
      clear:   () => { if (editorRef.current) editorRef.current.innerHTML = '' },
    }))

    const exec = useCallback((cmd: string, value?: string) => {
      editorRef.current?.focus()
      // execCommand is deprecated but has universal browser support for basic formatting
      document.execCommand(cmd, false, value)
      onChange?.(editorRef.current?.innerHTML ?? '')
    }, [onChange])

    const handleInsertLink = () => {
      const url = prompt('URL del enlace:')
      if (url) exec('createLink', /^https?:\/\//i.test(url) ? url : `https://${url}`)
    }

    const handleInsertHR = () => exec('insertHorizontalRule')

    // ── Imagen (modal) ────────────────────────────────────────────────────
    const openImageModalForInsert = () => {
      const sel = window.getSelection()
      savedRange.current = sel && sel.rangeCount && editorRef.current?.contains(sel.anchorNode)
        ? sel.getRangeAt(0).cloneRange()
        : null
      editingEl.current = null
      setImgInitial(undefined)
      setImgModalOpen(true)
    }

    const openImageModalForEdit = (imgEl: HTMLImageElement) => {
      const s = readImageState(imgEl)
      editingEl.current = s.el
      savedRange.current = null
      setImgInitial({ src: s.src, align: s.align, waNumber: s.waNumber, waMessage: s.waMessage, linkUrl: s.linkUrl })
      setImgModalOpen(true)
    }

    const handleImageResult = (r: ImageLinkResult) => {
      const html = buildImageHtml(r)
      const ed = editorRef.current
      if (!ed) return

      if (editingEl.current && ed.contains(editingEl.current)) {
        const tmp = document.createElement('div')
        tmp.innerHTML = html
        const node = tmp.firstElementChild
        if (node) editingEl.current.replaceWith(node)
      } else {
        ed.focus()
        const sel = window.getSelection()
        if (savedRange.current && sel) {
          sel.removeAllRanges()
          sel.addRange(savedRange.current)
        }
        document.execCommand('insertHTML', false, html)
      }
      editingEl.current = null
      savedRange.current = null
      onChange?.(ed.innerHTML)
    }

    const handleImageRemove = () => {
      const ed = editorRef.current
      if (ed && editingEl.current && ed.contains(editingEl.current)) {
        editingEl.current.remove()
        onChange?.(ed.innerHTML)
      }
      editingEl.current = null
    }

    return (
      <div className={cn('rounded-xl border border-[var(--color-border)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--color-primary)]/30 focus-within:border-[var(--color-primary)] transition-all', className)}>
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] flex-wrap">
          {TOOLBAR.map((group, gi) => (
            <span key={gi} className="flex items-center gap-0.5">
              {gi > 0 && <span className="w-px h-4 bg-[var(--color-border-strong)] mx-1" />}
              {group.map(btn => (
                <button
                  key={btn.cmd}
                  type="button"
                  title={btn.title}
                  onMouseDown={e => { e.preventDefault(); exec(btn.cmd) }}
                  className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text)] transition-colors"
                >
                  {btn.icon}
                </button>
              ))}
            </span>
          ))}
          <span className="w-px h-4 bg-[var(--color-border-strong)] mx-1" />
          <button
            type="button"
            title="Enlazar el texto seleccionado"
            onMouseDown={e => { e.preventDefault(); handleInsertLink() }}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text)] transition-colors"
          >
            <Link2 size={14} />
          </button>
          <button
            type="button"
            title="Insertar imagen (con link o botón de WhatsApp)"
            onMouseDown={e => { e.preventDefault(); openImageModalForInsert() }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text)] transition-colors text-xs font-medium"
          >
            <ImageIcon size={14} /> Imagen
          </button>
          <button
            type="button"
            title="Separador horizontal"
            onMouseDown={e => { e.preventDefault(); handleInsertHR() }}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text)] transition-colors"
          >
            <Minus size={14} />
          </button>

          {/* Heading selector */}
          <span className="w-px h-4 bg-[var(--color-border-strong)] mx-1" />
          <select
            onMouseDown={e => e.stopPropagation()}
            onChange={e => { exec('formatBlock', e.target.value); e.target.value = '' }}
            className="text-xs text-[var(--color-text-muted)] bg-transparent border-none outline-none cursor-pointer py-1"
            defaultValue=""
          >
            <option value="" disabled>Formato</option>
            <option value="p">Párrafo</option>
            <option value="h1">Título 1</option>
            <option value="h2">Título 2</option>
            <option value="h3">Título 3</option>
            <option value="blockquote">Cita</option>
          </select>
        </div>

        {/* Image guidelines hint */}
        <div className="px-3 py-1.5 text-[10px] flex gap-4 flex-wrap border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]"
          style={{ color: 'var(--color-text-subtle)' }}>
          <span>🖼️ Las imágenes se comprimen solas (~1000px, &lt;200 KB)</span>
          <span>👆 Tocá una imagen para editarla o ponerle un link</span>
          <span>💡 Imágenes pesadas caen en spam</span>
        </div>

        {/* Editable area */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => onChange?.(editorRef.current?.innerHTML ?? '')}
          onClick={(e) => {
            const t = e.target as HTMLElement
            if (t.tagName === 'IMG') { e.preventDefault(); openImageModalForEdit(t as HTMLImageElement) }
          }}
          style={{ minHeight }}
          data-placeholder={placeholder}
          className="px-4 py-3 text-sm text-[var(--color-text)] bg-[var(--color-surface)] outline-none leading-relaxed rich-editor-area"
        />

        <ImageLinkModal
          open={imgModalOpen}
          onClose={() => setImgModalOpen(false)}
          onSubmit={handleImageResult}
          onRemove={handleImageRemove}
          initial={imgInitial}
        />
      </div>
    )
  }
)

RichEditor.displayName = 'RichEditor'
