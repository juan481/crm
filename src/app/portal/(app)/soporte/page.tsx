'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Plus, AlertTriangle } from 'lucide-react'

interface TicketRow {
  id: string
  number: number
  title: string
  status: string
  category: string
  createdAt: string
  _count: { messages: number }
}

const STATUS_LABEL: Record<string, string> = {
  ABIERTO: 'Abierto', EN_PROCESO: 'En proceso', ESPERANDO: 'Esperando respuesta',
  RESUELTO: 'Resuelto', CERRADO: 'Cerrado',
}
const CATEGORIES = [
  { value: 'SOPORTE', label: 'Soporte técnico' },
  { value: 'FACTURACION', label: 'Facturación' },
  { value: 'CONSULTA', label: 'Consulta general' },
]

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
  borderRadius: '0.6rem', padding: '0.5rem 0.7rem', fontSize: '0.875rem', color: 'var(--color-text)', outline: 'none',
}

export default function PortalSoportePage() {
  const [rows, setRows] = useState<TicketRow[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'SOPORTE' })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => fetch('/api/portal/tickets').then((r) => r.json()).then((j) => setRows(j.data ?? [])).catch(() => setRows([]))
  useEffect(() => { load() }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.title.trim() || !form.description.trim()) { setError('Completá asunto y detalle.'); return }
    setSending(true)
    try {
      const res = await fetch('/api/portal/tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'No se pudo crear el ticket'); return }
      setForm({ title: '', description: '', category: 'SOPORTE' })
      setShowForm(false)
      load()
    } catch {
      setError('Error de conexión — probá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Soporte</h1>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-sm font-semibold text-white px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-primary)' }}>
            <Plus size={14} /> Nuevo
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="rounded-xl p-4 space-y-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <select style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input style={inputStyle} placeholder="Asunto" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea style={{ ...inputStyle, minHeight: 90, resize: 'none' }} placeholder="Contanos qué necesitás" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          {error && <p className="text-xs flex items-center gap-1" style={{ color: '#f87171' }}><AlertTriangle size={12} />{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowForm(false); setError(null) }} className="text-sm px-3 py-1.5 rounded-lg" style={{ color: 'var(--color-text-muted)' }}>Cancelar</button>
            <button type="submit" disabled={sending} className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-1.5 rounded-lg" style={{ background: 'var(--color-primary)', opacity: sending ? 0.65 : 1 }}>
              {sending && <Loader2 size={13} className="animate-spin" />} Enviar
            </button>
          </div>
        </form>
      )}

      {!rows ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" style={{ color: 'var(--color-text-subtle)' }} /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No abriste ningún ticket todavía.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((t) => (
            <Link key={t.id} href={`/portal/soporte/${t.id}`} className="block rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{t.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-subtle)' }}>#{String(t.number).padStart(4, '0')} · {new Date(t.createdAt).toLocaleDateString('es-AR')}</p>
                </div>
                <span className="text-[11px] font-medium shrink-0" style={{ color: 'var(--color-text-muted)' }}>{STATUS_LABEL[t.status] ?? t.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
