'use client'

import { useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import {
  Bold, Italic, Underline, List, ListOrdered,
  Link2, Image, AlignLeft, AlignCenter, AlignRight,
  Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
  function RichEditor({ placeholder = 'Escribí el contenido del email...', minHeight = 220, className, onChange }, ref) {
    const editorRef = useRef<HTMLDivElement>(null)

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
      if (url) exec('createLink', url)
    }

    const handleInsertImage = () => {
      const url = prompt('URL de la imagen:')
      if (url) exec('insertImage', url)
    }

    const handleInsertHR = () => exec('insertHorizontalRule')

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
            title="Insertar enlace"
            onMouseDown={e => { e.preventDefault(); handleInsertLink() }}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text)] transition-colors"
          >
            <Link2 size={14} />
          </button>
          <button
            type="button"
            title="Insertar imagen (URL)"
            onMouseDown={e => { e.preventDefault(); handleInsertImage() }}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text)] transition-colors"
          >
            <Image size={14} />
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

        {/* Editable area */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => onChange?.(editorRef.current?.innerHTML ?? '')}
          style={{ minHeight }}
          data-placeholder={placeholder}
          className="px-4 py-3 text-sm text-[var(--color-text)] bg-[var(--color-surface)] outline-none leading-relaxed rich-editor-area"
        />
      </div>
    )
  }
)

RichEditor.displayName = 'RichEditor'
