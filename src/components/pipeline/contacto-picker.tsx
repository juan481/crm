'use client'

// Buscador de contactos (persona) para vincular a una oportunidad. Async,
// mínimo: escribís 2+ letras, elegís, queda el id. Vacío = sin contacto.

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X, Contact } from 'lucide-react'

interface ContactoOption {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  empresa?: { id: string; name: string } | null
}

interface Props {
  value: string
  valueLabel?: string
  onChange: (id: string, label: string) => void
  label?: string
}

export function ContactoPicker({ value, valueLabel = '', onChange, label = 'Contacto (persona, opcional)' }: Props) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const selectedLabel = valueLabel

  useEffect(() => {
    const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const { data } = useQuery<{ data: ContactoOption[] }>({
    queryKey: ['contacto-picker', q],
    queryFn: async () => (await fetch(`/api/contactos?search=${encodeURIComponent(q)}&limit=12`)).json(),
    enabled: open && q.trim().length >= 2,
    staleTime: 20_000,
  })
  const options = data?.data ?? []

  const pick = (o: ContactoOption) => {
    onChange(o.id, `${o.firstName} ${o.lastName}`)
    setOpen(false)
    setQ('')
  }
  const clear = () => { onChange('', ''); setQ('') }

  return (
    <div className="relative" ref={boxRef}>
      <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{label}</label>

      {value && selectedLabel ? (
        <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
          <span className="flex items-center gap-1.5"><Contact size={13} style={{ color: 'var(--color-primary)' }} />{selectedLabel}</span>
          <button type="button" onClick={clear} style={{ color: 'var(--color-text-subtle)' }}><X size={13} /></button>
        </div>
      ) : (
        <div className="flex items-center rounded-xl px-3 py-2.5 gap-2"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <Search size={14} style={{ color: 'var(--color-text-subtle)' }} />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true) }}
            onFocusCapture={() => setOpen(true)}
            placeholder="Buscar por nombre..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--color-text)' }}
          />
        </div>
      )}

      {open && q.trim().length >= 2 && options.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border shadow-xl overflow-hidden"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-strong)', maxHeight: 220, overflowY: 'auto' }}>
          {options.map((o) => (
            <button key={o.id} type="button" onClick={() => pick(o)}
              className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[var(--color-surface-raised)]"
              style={{ color: 'var(--color-text)' }}>
              {o.firstName} {o.lastName}
              {o.empresa?.name && <span className="text-[11px] ml-1.5" style={{ color: 'var(--color-text-subtle)' }}>· {o.empresa.name}</span>}
              {!o.empresa?.name && o.phone && <span className="text-[11px] ml-1.5" style={{ color: 'var(--color-text-subtle)' }}>· {o.phone}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
