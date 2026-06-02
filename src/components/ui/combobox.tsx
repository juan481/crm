'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ComboboxProps {
  label?: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  allowCustom?: boolean
  className?: string
}

export function Combobox({
  label,
  value,
  onChange,
  options,
  placeholder = 'Seleccioná o escribí...',
  allowCustom = true,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState(value)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setInput(value) }, [value])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        // If user typed something not in options and allowCustom, keep it
        if (allowCustom && input && input !== value) onChange(input)
        else if (!allowCustom) setInput(value)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [input, value, onChange, allowCustom])

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(input.toLowerCase())
  )
  const showAddOption = allowCustom && input && !options.some((o) => o.toLowerCase() === input.toLowerCase())

  const select = (opt: string) => {
    onChange(opt)
    setInput(opt)
    setOpen(false)
  }

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setInput('')
    inputRef.current?.focus()
  }

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </label>
      )}
      <div
        className="relative flex items-center rounded-xl border transition-all"
        style={{
          background: 'var(--color-surface)',
          borderColor: open ? 'var(--color-primary)' : 'var(--color-border)',
          boxShadow: open ? '0 0 0 3px var(--color-primary-light)' : 'none',
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
          style={{ color: 'var(--color-text)' }}
        />
        <div className="flex items-center gap-1 pr-2">
          {value && (
            <button type="button" onClick={clear} className="p-0.5 rounded hover:opacity-70 transition-opacity" style={{ color: 'var(--color-text-subtle)' }}>
              <X size={13} />
            </button>
          )}
          <button type="button" onClick={() => { setOpen((v) => !v); inputRef.current?.focus() }} className="p-0.5" style={{ color: 'var(--color-text-subtle)' }}>
            <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
          </button>
        </div>
      </div>

      {open && (filtered.length > 0 || showAddOption) && (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl shadow-xl border overflow-hidden"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-strong)', maxHeight: '200px', overflowY: 'auto' }}
        >
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => select(opt)}
              className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[var(--color-surface-raised)]"
              style={{ color: opt === value ? 'var(--color-primary)' : 'var(--color-text)' }}
            >
              {opt}
            </button>
          ))}
          {showAddOption && (
            <button
              type="button"
              onClick={() => select(input)}
              className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors hover:bg-[var(--color-surface-raised)]"
              style={{ color: 'var(--color-primary)', borderTop: filtered.length > 0 ? '1px solid var(--color-border)' : 'none' }}
            >
              <Plus size={13} />
              Agregar &quot;{input}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  )
}
