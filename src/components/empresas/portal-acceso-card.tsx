'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { KeyRound, Plus, Trash2, Loader2, Mail, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

interface PortalUser { id: string; name: string; email: string; status: string; createdAt: string }

// Tarjeta de "Portal de clientes" en la ficha de la Empresa (Pagos & Portal).
// Da/quita acceso al portal (/portal) por email — el usuario entra por magic
// link, sin contraseña.
export function PortalAccesoCard({ empresaId, canManage }: { empresaId: string; canManage: boolean }) {
  const [users, setUsers] = useState<PortalUser[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () =>
    fetch(`/api/empresas/${empresaId}/portal-acceso`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setUsers(j.data ?? []))
      .catch(() => setUsers([]))

  useEffect(() => { load() }, [empresaId])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/empresas/${empresaId}/portal-acceso`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'No se pudo dar el acceso'); return }
      toast.success('Acceso creado — se le mandó el link por email')
      setEmail(''); setName(''); setAdding(false); load()
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  const revoke = async (userId: string) => {
    try {
      const res = await fetch(`/api/empresas/${empresaId}/portal-acceso?userId=${userId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Acceso revocado')
      load()
    } catch { toast.error('Error al revocar') }
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <KeyRound size={15} style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-subtle)' }}>
            Portal de clientes
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/empresas/${empresaId}/portal`}
            className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
          >
            <Eye size={13} /> Ver el portal
          </Link>
          {canManage && !adding && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
            >
              <Plus size={13} /> Dar acceso
            </button>
          )}
        </div>
      </div>

      {adding && (
        <form onSubmit={add} className="mb-3 space-y-2">
          <input
            type="email" required placeholder="email del cliente" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full text-sm rounded-lg px-3 py-2 outline-none"
            style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
          <input
            type="text" placeholder="nombre (opcional)" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full text-sm rounded-lg px-3 py-2 outline-none"
            style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--color-text-muted)' }}>Cancelar</button>
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-primary)', opacity: saving ? 0.6 : 1 }}>
              {saving && <Loader2 size={12} className="animate-spin" />} Crear y enviar link
            </button>
          </div>
        </form>
      )}

      {users === null ? (
        <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-text-subtle)' }} /></div>
      ) : users.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Nadie tiene acceso todavía. Dale acceso a un contacto para que pueda ver y pagar sus facturas y pedir soporte desde <code>/portal</code>.
        </p>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-xl px-3 py-2 group" style={{ border: '1px solid var(--color-border)' }}>
              <Mail size={13} style={{ color: 'var(--color-text-subtle)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: 'var(--color-text)' }}>{u.email}</p>
                {u.name && u.name !== u.email.split('@')[0] && <p className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>{u.name}</p>}
              </div>
              {canManage && (
                <button onClick={() => revoke(u.id)} className="p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Revocar acceso">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
