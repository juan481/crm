'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Percent, Info } from 'lucide-react'
import toast from 'react-hot-toast'

interface Categoria {
  id: string
  name: string
  parentId: string | null
  margenPct: number | null
}

// Fuera del render de CategoryMarginsManager a propósito — definirlo adentro
// de roots.map() hacía que React viera un tipo de componente NUEVO en cada
// render (cada tecleo cambia editingMargen → re-render → nueva referencia de
// función), remontando el <input> y perdiendo el foco a mitad de escritura
// (bug real encontrado en code-review: no se podía escribir un número de 2
// dígitos de un tirón).
function MargenInput({
  c, depth, editingValue, saving, onChange, onSave,
}: {
  c: Categoria
  depth: number
  editingValue: string | undefined
  saving: boolean
  onChange: (id: string, value: string) => void
  onSave: (id: string, value: string) => void
}) {
  return (
    <div className="flex items-center gap-3" style={{ paddingLeft: depth * 16 }}>
      <span className="flex-1 text-sm truncate" style={{ color: depth === 0 ? 'var(--color-text)' : 'var(--color-text-muted)', fontWeight: depth === 0 ? 600 : 400 }}>{c.name}</span>
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="number" min="0" max="100"
          placeholder="—"
          value={editingValue !== undefined ? editingValue : (c.margenPct ?? '')}
          onChange={(e) => onChange(c.id, e.target.value)}
          onBlur={(e) => { if (e.target.value !== String(c.margenPct ?? '')) onSave(c.id, e.target.value) }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          disabled={saving}
          className="w-20 text-right text-sm rounded-lg px-2 py-1 outline-none"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        />
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>%</span>
      </div>
    </div>
  )
}

// Recursivo a cualquier profundidad — catalogo-sync.ts resuelve
// "Categoria/Rubro" partiendo por ">" sin límite de niveles (ver
// resolveCategoryId en catalogo-categories.ts), así que una categoría de
// nivel 3 era invisible acá (bug real: nunca se le podía poner margen,
// quedaba null para siempre y excluida de comisión en silencio).
function CategoryBranch({
  node, depth, childrenOf, editingMargen, savingId, onChange, onSave,
}: {
  node: Categoria
  depth: number
  childrenOf: (id: string) => Categoria[]
  editingMargen: Record<string, string>
  savingId: string | null
  onChange: (id: string, value: string) => void
  onSave: (id: string, value: string) => void
}) {
  const children = childrenOf(node.id)
  return (
    <>
      <MargenInput c={node} depth={depth} editingValue={editingMargen[node.id]} saving={savingId === node.id} onChange={onChange} onSave={onSave} />
      {children.map((c) => (
        <CategoryBranch key={c.id} node={c} depth={depth + 1} childrenOf={childrenOf} editingMargen={editingMargen} savingId={savingId} onChange={onChange} onSave={onSave} />
      ))}
    </>
  )
}

// Margen por familia de producto + "utilidad real" de la empresa — alimenta
// el motor de comisiones (reestructuración Abba 2026-10, ver
// src/lib/commissions.ts). Cada familia tiene su propio % (5/15/35%, no un
// 40% fijo sobre costo como antes) y Mauro lo puede cambiar cuando quiera.
export function CategoryMarginsManager() {
  const qc = useQueryClient()
  const [editingMargen, setEditingMargen] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [editingUtilidad, setEditingUtilidad] = useState<string | null>(null)
  const [savingUtilidad, setSavingUtilidad] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['catalogo-margenes'],
    queryFn: async () => {
      const r = await fetch('/api/catalogo/margenes')
      if (!r.ok) return { data: [] }
      return r.json()
    },
    staleTime: 30_000,
  })
  const categorias: Categoria[] = data?.data ?? []
  const roots = categorias.filter(c => !c.parentId)
  const childrenOf = (id: string) => categorias.filter(c => c.parentId === id)

  const { data: utilidadData } = useQuery({
    queryKey: ['organization-utilidad-real'],
    queryFn: async () => (await fetch('/api/organization/utilidad-real')).json(),
    staleTime: 30_000,
  })
  const utilidadRealPct: number = utilidadData?.data?.utilidadRealPct ?? 0

  const saveMargen = async (id: string, raw: string) => {
    const value = raw.trim() === '' ? null : Number(raw)
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
      toast.error('El margen tiene que ser un número entre 0 y 100')
      return
    }
    setSavingId(id)
    try {
      const res = await fetch('/api/catalogo/margenes', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, margenPct: value }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      qc.invalidateQueries({ queryKey: ['catalogo-margenes'] })
    } catch { toast.error('Error de conexión') } finally {
      setSavingId(null)
      setEditingMargen((e) => { const n = { ...e }; delete n[id]; return n })
    }
  }

  const saveUtilidad = async (raw: string) => {
    const value = Number(raw)
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      toast.error('Tiene que ser un número entre 0 y 100')
      return
    }
    setSavingUtilidad(true)
    try {
      const res = await fetch('/api/organization/utilidad-real', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utilidadRealPct: value }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      qc.invalidateQueries({ queryKey: ['organization-utilidad-real'] })
    } catch { toast.error('Error de conexión') } finally {
      setSavingUtilidad(false)
      setEditingUtilidad(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-4 space-y-2" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2">
          <Percent size={16} style={{ color: 'var(--color-primary)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Utilidad real</h3>
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          % que se aplica sobre la ganancia (precio × margen de familia) para llegar a la utilidad que cuenta para comisión.
        </p>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="number" min="0" max="100"
            value={editingUtilidad ?? String(utilidadRealPct)}
            onChange={(e) => setEditingUtilidad(e.target.value)}
            onBlur={(e) => { if (e.target.value !== String(utilidadRealPct)) saveUtilidad(e.target.value) }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            disabled={savingUtilidad}
            className="w-24 text-sm rounded-lg px-3 py-1.5 outline-none"
            style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>%</span>
          {utilidadRealPct === 0 && (
            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-subtle)' }}>
              <Info size={11} /> En 0%, nadie genera comisión todavía
            </span>
          )}
        </div>
      </div>

      <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Margen por familia</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Sin margen cargado, esa familia no aporta ganancia a la comisión hasta que se complete.
          </p>
        </div>

        {isLoading ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
        ) : roots.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
            Todavía no hay categorías — se crean solas al sincronizar el catálogo del proveedor.
          </p>
        ) : (
          <div className="space-y-4">
            {roots.map((root) => (
              <div key={root.id} className="space-y-1.5">
                <CategoryBranch
                  node={root} depth={0} childrenOf={childrenOf}
                  editingMargen={editingMargen} savingId={savingId}
                  onChange={(id, value) => setEditingMargen((ed) => ({ ...ed, [id]: value }))}
                  onSave={saveMargen}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
