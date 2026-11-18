'use client'

// UI compartida de "Bases de contactos" (listas/origen: Expo Rosario 2026,
// Exposeg…): hook de datos, modal para elegir/crear la base al importar un
// Excel (Contactos y Empresas), y administrador de bases (crear, renombrar,
// borrar). Backend en /api/contactos/bases.

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Layers, Pencil, Trash2, Check, X, Plus } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import type { ContactoBase } from '@/types'
import toast from 'react-hot-toast'

export const CONTACTO_BASES_KEY = ['contacto-bases'] as const

export function useContactoBases(enabled = true) {
  return useQuery<ContactoBase[]>({
    queryKey: CONTACTO_BASES_KEY,
    queryFn: async () => {
      const res = await fetch('/api/contactos/bases')
      if (!res.ok) return []
      return (await res.json()).data ?? []
    },
    enabled,
    staleTime: 15_000,
  })
}

/** Crea la base (o devuelve la existente con ese nombre). Lanza Error con el mensaje del server. */
export async function createContactoBase(name: string): Promise<{ id: string; name: string; existing: boolean }> {
  const res = await fetch('/api/contactos/bases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error ?? 'No se pudo crear la base')
  return { id: j.data.id, name: j.data.name, existing: !!j.existing }
}

const inputCls = 'w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30'
const inputStyle = { border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }

type Modo = 'ninguna' | 'existente' | 'nueva'

/**
 * Paso previo a importar un Excel: ¿a qué base van estos contactos?
 * Sin base / una existente / crear una nueva en el momento.
 */
export function ImportBaseModal({
  open, fileName, rowCount, onConfirm, onCancel,
}: {
  open: boolean
  fileName: string
  rowCount: number
  onConfirm: (base: { id: string; name: string } | null) => void
  onCancel: () => void
}) {
  const qc = useQueryClient()
  const { data: bases = [] } = useContactoBases(open)
  const [modo, setModo] = useState<Modo>('nueva')
  const [baseId, setBaseId] = useState('')
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)

  // Cada archivo arranca limpio: sugerimos el nombre del archivo como base nueva.
  useEffect(() => {
    if (!open) return
    setModo('nueva')
    setBaseId('')
    setNombre(fileName.replace(/\.(xlsx|xls)$/i, '').replace(/[_]+/g, ' ').trim().slice(0, 80))
  }, [open, fileName])

  const confirmar = async () => {
    if (modo === 'ninguna') { onConfirm(null); return }
    if (modo === 'existente') {
      const b = bases.find((x) => x.id === baseId)
      if (!b) { toast.error('Elegí una base'); return }
      onConfirm({ id: b.id, name: b.name })
      return
    }
    const n = nombre.trim()
    if (n.length < 2) { toast.error('Poné un nombre para la base nueva'); return }
    setSaving(true)
    try {
      const b = await createContactoBase(n)
      if (b.existing) toast(`Ya existía la base "${b.name}" — se suman a esa`, { icon: 'ℹ️' })
      qc.invalidateQueries({ queryKey: CONTACTO_BASES_KEY })
      onConfirm({ id: b.id, name: b.name })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear la base')
    } finally {
      setSaving(false)
    }
  }

  const opcion = (m: Modo, titulo: string, detalle: string, extra?: React.ReactNode) => (
    <label
      className="block p-3 rounded-xl cursor-pointer transition-colors"
      style={{ border: `1px solid ${modo === m ? 'var(--color-primary)' : 'var(--color-border)'}`, background: modo === m ? 'rgba(99,102,241,0.06)' : 'transparent' }}
    >
      <div className="flex items-start gap-2.5">
        <input type="radio" name="modo-base" checked={modo === m} onChange={() => setModo(m)} className="mt-0.5 accent-[var(--color-primary)]" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{titulo}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{detalle}</p>
          {modo === m && extra && <div className="mt-2">{extra}</div>}
        </div>
      </div>
    </label>
  )

  return (
    <Modal open={open} onClose={() => { if (!saving) onCancel() }} title="¿A qué base van estos contactos?" size="md">
      <div className="space-y-3">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          <span className="font-medium" style={{ color: 'var(--color-text)' }}>{fileName}</span> · {rowCount.toLocaleString('es-AR')} filas.
          Asignarlos a una base te deja filtrar después los envíos masivos por ese origen. Los contactos que ya estaban cargados también se suman a la base.
        </p>

        {opcion('nueva', 'Crear una base nueva', 'Ej.: "Exposeg 2026", "Expo Rosario 2026".', (
          <input
            autoFocus value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre de la base" className={inputCls} style={inputStyle}
          />
        ))}

        {opcion('existente', 'Sumar a una base existente', bases.length ? `${bases.length} base${bases.length !== 1 ? 's' : ''} creada${bases.length !== 1 ? 's' : ''}` : 'Todavía no hay bases creadas.', (
          bases.length > 0 ? (
            <select value={baseId} onChange={(e) => setBaseId(e.target.value)} className={inputCls} style={inputStyle}>
              <option value="">Elegir base…</option>
              {bases.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.total})</option>)}
            </select>
          ) : null
        ))}

        {opcion('ninguna', 'Sin base', 'Importar sin asignarlos a ninguna lista.')}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancelar</Button>
          <Button onClick={confirmar} loading={saving}>Importar</Button>
        </div>
      </div>
    </Modal>
  )
}

/** Administrador de bases: lista con conteos, crear, renombrar y borrar (borrar sólo Admin+). */
export function BasesManagerModal({
  open, onClose, canDelete, onVer,
}: {
  open: boolean
  onClose: () => void
  canDelete: boolean
  onVer?: (baseId: string) => void
}) {
  const qc = useQueryClient()
  const { data: bases = [], isLoading } = useContactoBases(open)
  const [nueva, setNueva] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) { setEditId(null); setConfirmDel(null); setNueva('') }
  }, [open])

  const refresh = () => {
    qc.invalidateQueries({ queryKey: CONTACTO_BASES_KEY })
    qc.invalidateQueries({ queryKey: ['contactos'] })
  }

  const crear = async () => {
    const n = nueva.trim()
    if (n.length < 2) return
    setBusy(true)
    try {
      const b = await createContactoBase(n)
      toast.success(b.existing ? `La base "${b.name}" ya existía` : `Base "${b.name}" creada`)
      setNueva('')
      refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
    finally { setBusy(false) }
  }

  const renombrar = async (id: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/contactos/bases/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editName }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Error'); return }
      setEditId(null)
      refresh()
    } catch { toast.error('Error de conexión') }
    finally { setBusy(false) }
  }

  const borrar = async (id: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/contactos/bases/${id}`, { method: 'DELETE' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Error'); return }
      toast.success(j.message)
      setConfirmDel(null)
      refresh()
    } catch { toast.error('Error de conexión') }
    finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Bases de contactos" size="md">
      <div className="space-y-4">
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Listas por origen (ferias, eventos, compras de base). Se usan para filtrar los envíos masivos en Comunicaciones → Nueva campaña → Base. Borrar una base no borra los contactos.
        </p>

        <div className="flex gap-2">
          <input value={nueva} maxLength={80} onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); crear() } }}
            placeholder="Nueva base (ej.: Exposeg 2026)" className={inputCls} style={inputStyle} />
          <Button onClick={crear} disabled={busy || nueva.trim().length < 2} leftIcon={<Plus size={14} />}>Crear</Button>
        </div>

        <div className="surface-raised rounded-xl divide-y divide-[var(--color-border)] max-h-80 overflow-y-auto">
          {isLoading ? (
            <p className="p-4 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>Cargando…</p>
          ) : bases.length === 0 ? (
            <p className="p-4 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>Todavía no hay bases. Creá una acá o al importar un Excel.</p>
          ) : bases.map((b) => (
            <div key={b.id} className="flex items-center gap-3 px-4 py-2.5">
              <Layers size={14} className="shrink-0" style={{ color: 'var(--color-primary)' }} />
              <div className="flex-1 min-w-0">
                {editId === b.id ? (
                  <input autoFocus value={editName} maxLength={80} onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); renombrar(b.id) } if (e.key === 'Escape') setEditId(null) }}
                    className={inputCls} style={inputStyle} />
                ) : (
                  <>
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{b.name}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {b.total.toLocaleString('es-AR')} contacto{b.total !== 1 ? 's' : ''} · {b.conEmail.toLocaleString('es-AR')} con email
                    </p>
                  </>
                )}
              </div>
              {editId === b.id ? (
                <>
                  <button type="button" onClick={() => renombrar(b.id)} disabled={busy} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-overlay)]" title="Guardar"><Check size={14} className="text-emerald-400" /></button>
                  <button type="button" onClick={() => setEditId(null)} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-overlay)]" title="Cancelar"><X size={14} style={{ color: 'var(--color-text-muted)' }} /></button>
                </>
              ) : confirmDel === b.id ? (
                <>
                  <span className="text-xs text-red-400">¿Borrar?</span>
                  <button type="button" onClick={() => borrar(b.id)} disabled={busy} className="px-2 py-1 rounded-lg text-xs font-medium bg-red-500/15 text-red-400 hover:bg-red-500/25">Sí</button>
                  <button type="button" onClick={() => setConfirmDel(null)} className="px-2 py-1 rounded-lg text-xs" style={{ color: 'var(--color-text-muted)' }}>No</button>
                </>
              ) : (
                <>
                  {onVer && (
                    <button type="button" onClick={() => { onVer(b.id); onClose() }} className="px-2 py-1 rounded-lg text-xs font-medium hover:bg-[var(--color-surface-overlay)]" style={{ color: 'var(--color-primary)' }}>Ver</button>
                  )}
                  <button type="button" onClick={() => { setEditId(b.id); setEditName(b.name) }} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-overlay)]" title="Renombrar"><Pencil size={13} style={{ color: 'var(--color-text-muted)' }} /></button>
                  {canDelete && (
                    <button type="button" onClick={() => setConfirmDel(b.id)} className="p-1.5 rounded-lg hover:bg-red-500/10" title="Borrar base"><Trash2 size={13} className="text-red-400" /></button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

/** Bases de UN contacto en su ficha: ver, sacar y sumar a otra base. */
export function ContactoBasesEditor({
  contactoId, bases, canEdit, onChanged,
}: {
  contactoId: string
  bases: Array<{ id: string; name: string }>
  canEdit: boolean
  onChanged: () => void
}) {
  const qc = useQueryClient()
  const { data: todas = [] } = useContactoBases(canEdit)
  const [busy, setBusy] = useState(false)
  const disponibles = todas.filter((b) => !bases.some((x) => x.id === b.id))

  const cambiar = async (baseId: string, action: 'add' | 'remove') => {
    setBusy(true)
    try {
      const res = await fetch(`/api/contactos/bases/${baseId}/miembros`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactoIds: [contactoId], action }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Error'); return }
      qc.invalidateQueries({ queryKey: CONTACTO_BASES_KEY })
      qc.invalidateQueries({ queryKey: ['contactos'] })
      onChanged()
    } catch { toast.error('Error de conexión') }
    finally { setBusy(false) }
  }

  if (!canEdit && bases.length === 0) return null
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Layers size={14} style={{ color: 'var(--color-text-muted)' }} />
      {bases.length === 0 && <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Sin base</span>}
      {bases.map((b) => (
        <span key={b.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--color-primary)' }}>
          {b.name}
          {canEdit && (
            <button type="button" disabled={busy} onClick={() => cambiar(b.id, 'remove')} title="Sacar de esta base" className="hover:text-red-400">
              <X size={11} />
            </button>
          )}
        </span>
      ))}
      {canEdit && disponibles.length > 0 && (
        <select value="" disabled={busy} onChange={(e) => { if (e.target.value) cambiar(e.target.value, 'add') }}
          className="text-xs rounded-lg px-2 py-1 border focus:outline-none" style={inputStyle} aria-label="Sumar a una base">
          <option value="">+ Sumar a base…</option>
          {disponibles.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}
    </div>
  )
}

/** Chips de bases de un contacto (lista). */
export function BaseChips({ bases }: { bases?: Array<{ id: string; name: string }> }) {
  if (!bases || bases.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {bases.map((b) => (
        <span key={b.id} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
          style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--color-primary)' }}>
          <Layers size={9} />{b.name}
        </span>
      ))}
    </div>
  )
}
