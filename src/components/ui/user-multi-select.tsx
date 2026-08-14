'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { Avatar } from './avatar'

interface UserOption { id: string; name: string; avatarUrl?: string | null }

// Selector de "colaboradores" — no obligatorio, por eso el estado vacío
// dice explícitamente "opcional". excludeId saca al asignado principal de
// la lista (no tiene sentido ofrecerlo como colaborador de sí mismo).
export function UserMultiSelect({
  label, users, selectedIds, onChange, excludeId,
}: {
  label?: string
  users: UserOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  excludeId?: string | null
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const options  = users.filter(u => u.id !== excludeId)
  const selected = options.filter(u => selectedIds.includes(u.id))

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
  }

  return (
    <div className="flex flex-col gap-1.5 relative" ref={ref}>
      {label && <label className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-sm text-left min-h-[42px]"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
      >
        {selected.length === 0 ? (
          <span style={{ color: 'var(--color-text-subtle)' }}>Nadie más (opcional)</span>
        ) : (
          <span className="flex items-center gap-1.5 flex-wrap py-0.5">
            {selected.map(u => (
              <span key={u.id} className="inline-flex items-center gap-1 pl-0.5 pr-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: 'var(--color-surface-raised)' }}>
                <Avatar name={u.name} src={u.avatarUrl} size="xs" />
                {u.name}
              </span>
            ))}
          </span>
        )}
        <ChevronDown size={14} style={{ color: 'var(--color-text-subtle)' }} className="shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 left-0 right-0 top-full mt-1 rounded-xl overflow-hidden shadow-lg max-h-56 overflow-y-auto"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)' }}>
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>No hay más personas</div>
          ) : options.map(u => {
            const checked = selectedIds.includes(u.id)
            return (
              <button key={u.id} type="button" onClick={() => toggle(u.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--color-surface-raised)] transition-colors">
                <Avatar name={u.name} src={u.avatarUrl} size="xs" />
                <span className="flex-1 text-sm truncate" style={{ color: 'var(--color-text)' }}>{u.name}</span>
                {checked && <Check size={14} style={{ color: 'var(--color-primary)' }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
