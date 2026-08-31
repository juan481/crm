'use client'

// Administración de productos KIT (compuestos). Un KIT se arma con productos
// del catálogo — típicamente pegando los códigos que devuelve la IA de
// cotización — y se le pone UN precio final. Al cliente sólo se le muestra
// ese precio: el desglose de componentes y el margen son internos.

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, Package, Boxes, AlertTriangle, X, ClipboardPaste,
  Search, PackagePlus, TriangleAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import type { Kit, Product } from '@/types'
import toast from 'react-hot-toast'

const CURRENCY_OPTIONS = [
  { value: 'ARS', label: 'ARS — Peso arg.' },
  { value: 'USD', label: 'USD — Dólar' },
  { value: 'EUR', label: 'EUR — Euro' },
]

interface DraftComponent {
  productId: string | null
  name: string
  sku: string | null
  price: number | null
  currency: string | null
  quantity: number
  error?: string | null // sólo para códigos pegados que no matchearon
}

interface KitForm {
  name: string
  description: string
  price: string
  currency: string
  unit: string
  components: DraftComponent[]
}

const EMPTY_FORM: KitForm = { name: '', description: '', price: '', currency: 'ARS', unit: 'kit', components: [] }

export function KitsManager() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const canManage = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Kit | null>(null)
  const [form, setForm] = useState<KitForm>(EMPTY_FORM)
  // El usuario eligió la moneda a mano → no la pisamos con la de los componentes.
  const [currencyTouched, setCurrencyTouched] = useState(false)
  // Campo auxiliar "Marcación %": si tiene un número, el precio se calcula
  // como costo × (1 + marcación/100). Vacío = precio manual.
  const [markupDraft, setMarkupDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteKit, setDeleteKit] = useState<Kit | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Paste + búsqueda dentro del modal
  const [pasteText, setPasteText] = useState('')
  const [resolving, setResolving] = useState(false)
  const [showPaste, setShowPaste] = useState(false)
  const [compSearch, setCompSearch] = useState('')

  const { data, isLoading, isError } = useQuery<{ data: Kit[] }>({
    queryKey: ['kits'],
    queryFn: async () => (await fetch('/api/catalogo/kits')).json(),
    staleTime: 30_000,
  })
  const kits = data?.data ?? []

  const { data: searchData } = useQuery<{ data: Product[] }>({
    queryKey: ['kit-comp-search', compSearch],
    queryFn: async () => (await fetch(`/api/catalogo/products?q=${encodeURIComponent(compSearch)}&limit=15&withCount=0`)).json(),
    enabled: showModal && compSearch.trim().length >= 2,
    staleTime: 20_000,
  })
  const searchResults = (searchData?.data ?? []).filter((p) => !p.isKit)

  // ── Totales internos (margen / marcación) ────────────────────────────────
  const totals = useMemo(() => {
    const matched = form.components.filter((c) => c.productId && c.price != null)
    const subtotal = matched.reduce((s, c) => s + (c.price ?? 0) * c.quantity, 0)
    const price = Number(form.price) || 0
    const margen = price - subtotal
    // Margen = ganancia ÷ precio de venta. Marcación = ganancia ÷ costo.
    const margenPct = price > 0 ? (margen / price) * 100 : 0
    const marcacionPct = subtotal > 0 ? (margen / subtotal) * 100 : 0
    const unresolved = form.components.filter((c) => c.error).length
    // Moneda de los componentes matcheados: una sola, o null si hay mezcla.
    const monedas = Array.from(new Set(matched.map((c) => c.currency).filter(Boolean))) as string[]
    const componentsCurrency = monedas.length === 1 ? monedas[0] : null
    const mixedCurrency = monedas.length > 1
    const currencyMismatch = componentsCurrency != null && componentsCurrency !== form.currency
    return {
      subtotal, price, margen, margenPct, marcacionPct, unresolved, count: matched.length,
      componentsCurrency, mixedCurrency, currencyMismatch, monedas,
    }
  }, [form.components, form.price, form.currency])

  // Los productos del catálogo tienen su propia moneda (ej. Abba carga todo en
  // USD). Si el KIT arrancó en otra, el costo/margen mezclan monedas — se
  // adopta la de los componentes salvo que el usuario la haya tocado a mano.
  useEffect(() => {
    if (!currencyTouched && totals.componentsCurrency && totals.componentsCurrency !== form.currency) {
      setForm((f) => ({ ...f, currency: totals.componentsCurrency! }))
    }
  }, [totals.componentsCurrency, currencyTouched, form.currency])

  // Si el usuario está trabajando con "Marcación %", al agregar/sacar un
  // componente el precio se recalcula solo para mantener esa marcación
  // (es lo que se espera: "puse 40% arriba" → el precio sube si sumo algo).
  // Si tipeó un precio a mano (markupDraft vacío), no se toca.
  useEffect(() => {
    const mk = Number(markupDraft)
    if (markupDraft.trim() !== '' && !isNaN(mk) && totals.subtotal > 0) {
      const next = (totals.subtotal * (1 + mk / 100)).toFixed(2)
      setForm((f) => (f.price === next ? f : { ...f, price: next }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.subtotal])

  const openCreate = () => {
    setEditing(null); setForm(EMPTY_FORM); setCurrencyTouched(false); setMarkupDraft('')
    setPasteText(''); setShowPaste(false); setCompSearch(''); setShowModal(true)
  }
  const openEdit = (k: Kit) => {
    setEditing(k)
    setForm({
      name: k.name,
      description: k.description ?? '',
      price: String(k.price),
      currency: k.currency,
      unit: k.unit || 'kit',
      components: (k.kitComponents ?? []).map((c) => ({
        productId: c.component.id,
        name: c.component.name,
        sku: c.component.sku,
        price: c.component.price,
        currency: c.component.currency,
        quantity: c.quantity,
      })),
    })
    // Ya tiene moneda propia elegida — respetarla, no auto-adoptar.
    setCurrencyTouched(true); setMarkupDraft('')
    setPasteText(''); setShowPaste(false); setCompSearch(''); setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(EMPTY_FORM); setCurrencyTouched(false); setMarkupDraft('') }

  const addComponent = (c: DraftComponent) => {
    setForm((f) => {
      // si ya está, suma cantidad
      const i = f.components.findIndex((x) => x.productId && x.productId === c.productId)
      if (i >= 0) {
        const next = [...f.components]
        next[i] = { ...next[i], quantity: next[i].quantity + c.quantity }
        return { ...f, components: next }
      }
      return { ...f, components: [...f.components, c] }
    })
  }

  const setQty = (idx: number, q: number) =>
    setForm((f) => ({ ...f, components: f.components.map((c, i) => (i === idx ? { ...c, quantity: Math.max(1, q) } : c)) }))
  const removeComponent = (idx: number) =>
    setForm((f) => ({ ...f, components: f.components.filter((_, i) => i !== idx) }))

  const handleResolvePaste = async () => {
    if (!pasteText.trim()) return
    setResolving(true)
    try {
      const res = await fetch('/api/catalogo/kits/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al resolver'); return }
      const rows: DraftComponent[] = (json.data ?? []).map((r: any) => ({
        productId: r.productId, name: r.name ?? r.sku ?? '(sin nombre)', sku: r.sku,
        price: r.price, currency: r.currency ?? null, quantity: r.quantity, error: r.error,
      }))
      if (rows.length === 0) { toast.error('No se detectaron códigos en el texto'); return }
      // Mergea: los que matchearon se agregan/actualizan; los que no, quedan como fila roja.
      setForm((f) => {
        const next = [...f.components]
        for (const r of rows) {
          if (r.productId) {
            const i = next.findIndex((x) => x.productId === r.productId)
            if (i >= 0) next[i] = { ...next[i], quantity: next[i].quantity + r.quantity }
            else next.push(r)
          } else {
            // no duplicar el mismo código sin match
            if (!next.some((x) => !x.productId && (x.sku ?? '').toLowerCase() === (r.sku ?? '').toLowerCase())) next.push(r)
          }
        }
        return { ...f, components: next }
      })
      setPasteText('')
      const { ok, sinMatch } = json.resumen ?? {}
      toast.success(`${ok ?? 0} componente(s) encontrado(s)${sinMatch ? ` · ${sinMatch} sin match` : ''}`)
    } catch { toast.error('Error de conexión') } finally { setResolving(false) }
  }

  const priceInvalid = form.price.trim() === '' || isNaN(Number(form.price)) || Number(form.price) < 0

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Poné un nombre al KIT'); return }
    if (priceInvalid) { toast.error('Cargá el precio final del KIT (arriba del botón está el aviso)'); return }
    const matched = form.components.filter((c) => c.productId)
    if (matched.length === 0) { toast.error('Agregá al menos un componente válido'); return }
    if (totals.unresolved > 0 && !confirm(`Hay ${totals.unresolved} código(s) sin match en el catálogo. Se van a ignorar. ¿Guardar igual?`)) return

    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: Number(form.price),
        currency: form.currency,
        unit: form.unit.trim() || 'kit',
        components: matched.map((c) => ({ productId: c.productId, quantity: c.quantity })),
      }
      const url = editing ? `/api/catalogo/kits/${editing.id}` : '/api/catalogo/kits'
      const res = await fetch(url, { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Error al guardar')
        if (json.detalle) console.warn('KIT sin resolver:', json.detalle)
        return
      }
      toast.success(editing ? 'KIT actualizado' : 'KIT creado')
      qc.invalidateQueries({ queryKey: ['kits'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      closeModal()
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteKit) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/catalogo/kits/${deleteKit.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success('KIT eliminado')
      qc.invalidateQueries({ queryKey: ['kits'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      setDeleteKit(null)
    } catch { toast.error('Error de conexión') } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: 'var(--color-text-subtle)' }}>
            <Boxes size={14} /> KITs (productos compuestos)
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Combos armados con productos del catálogo. Se cotizan como una sola línea con un precio final — el cliente no ve el desglose.
          </p>
        </div>
        {canManage && (
          <Button size="sm" leftIcon={<Plus size={14} />} onClick={openCreate}>Nuevo KIT</Button>
        )}
      </div>

      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          <AlertTriangle size={16} /> Error al cargar los KITs.
        </div>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>KIT</th>
              <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>Componentes</th>
              <th className="px-4 py-3 text-right font-semibold hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>Costo interno</th>
              <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Precio KIT</th>
              <th className="px-4 py-3 text-right font-semibold hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>Margen</th>
              {canManage && <th className="px-4 py-3 w-20" />}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>Cargando...</td></tr>
            ) : kits.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <Boxes size={32} className="mx-auto mb-3" style={{ color: 'var(--color-text-subtle)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Todavía no hay KITs</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>
                    Armá uno pegando los códigos que te devuelve la IA de cotización.
                  </p>
                </td>
              </tr>
            ) : kits.map((k) => (
              <tr key={k.id} style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }} className="hover:bg-[var(--color-surface-raised)] transition-colors">
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(99,102,241,0.1)' }}>
                      <Boxes size={13} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div>
                      {k.name}
                      {k.algunComponenteSinStock && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full text-amber-500" style={{ background: 'rgba(245,158,11,0.12)' }}>
                          <TriangleAlert size={9} /> componente sin stock
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>
                  {(k.kitComponents ?? []).map((c) => `${c.quantity}× ${c.component.name}`).join(' · ') || '—'}
                </td>
                <td className="px-4 py-3 text-right hidden md:table-cell" style={{ color: 'var(--color-text-subtle)' }}>
                  {formatCurrency(k.componentesSubtotal, k.currency)}
                </td>
                <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--color-text)' }}>
                  {formatCurrency(k.price, k.currency)}
                </td>
                <td className="px-4 py-3 text-right hidden md:table-cell font-semibold" style={{ color: k.monedaDesalineada ? '#d97706' : k.margen >= 0 ? '#10b981' : '#ef4444' }}>
                  {k.monedaDesalineada ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-normal">
                      <TriangleAlert size={10} /> moneda mezclada
                    </span>
                  ) : (
                    <>
                      {formatCurrency(k.margen, k.currency)}
                      <span className="block text-[10px] font-normal" style={{ color: 'var(--color-text-subtle)' }}>
                        {k.margenPct.toFixed(0)}% margen · {k.marcacionPct.toFixed(0)}% marcación
                      </span>
                    </>
                  )}
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(k)} className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-muted)' }}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleteKit(k)} className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-400" style={{ color: 'var(--color-text-muted)' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit */}
      <Modal open={showModal} onClose={closeModal} title={editing ? 'Editar KIT' : 'Nuevo KIT'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="Nombre del KIT *" placeholder="Ej: Kit 2 cámaras + instalación" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <Input label="Unidad" placeholder="kit" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Descripción (opcional)</label>
            <textarea
              rows={2}
              placeholder="Qué incluye, para qué sirve..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all"
              style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>

          {/* Agregar productos: buscador (forma principal) */}
          <div className="space-y-1.5">
            <Input
              label="Agregá los productos que lleva el KIT *"
              leftIcon={<Search size={14} />}
              placeholder="Buscá por nombre, SKU o marca y hacé clic para sumarlo..."
              value={compSearch}
              onChange={(e) => setCompSearch(e.target.value)}
            />
            {compSearch.trim().length >= 2 && searchResults.length > 0 && (
              <div className="rounded-lg max-h-40 overflow-y-auto" style={{ border: '1px solid var(--color-border)' }}>
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { addComponent({ productId: p.id, name: p.name, sku: p.sku ?? null, price: p.price, currency: p.currency, quantity: 1 }); setCompSearch('') }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-raised)] transition-colors"
                    style={{ color: 'var(--color-text)' }}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <PackagePlus size={13} className="shrink-0" style={{ color: 'var(--color-primary)' }} />
                      <span className="truncate">{p.name}</span>
                      {p.sku && <span className="text-[10px] shrink-0" style={{ color: 'var(--color-text-subtle)' }}>{p.sku}</span>}
                    </span>
                    <span className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>{formatCurrency(p.price, p.currency)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lista de componentes */}
          {form.components.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
              {form.components.map((c, i) => (
                <div
                  key={c.productId ?? `x-${c.sku}-${i}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm"
                  style={{ borderTop: i ? '1px solid var(--color-border)' : undefined, background: c.error ? 'rgba(239,68,68,0.06)' : 'var(--color-surface)' }}
                >
                  {c.error ? (
                    <TriangleAlert size={13} className="shrink-0 text-red-400" />
                  ) : (
                    <Package size={13} className="shrink-0" style={{ color: 'var(--color-text-subtle)' }} />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block truncate" style={{ color: c.error ? '#ef4444' : 'var(--color-text)' }}>
                      {c.name}
                    </span>
                    {c.error
                      ? <span className="text-[11px] text-red-400">{c.sku} — {c.error}</span>
                      : <span className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
                          {c.sku ? `${c.sku} · ` : ''}{c.price != null ? formatCurrency(c.price, form.currency) : ''}
                        </span>}
                  </span>
                  {!c.error && (
                    <input
                      type="number" min={1} value={c.quantity}
                      onChange={(e) => setQty(i, Number(e.target.value))}
                      className="w-14 text-center text-xs rounded-lg px-2 py-1 outline-none"
                      style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                    />
                  )}
                  <button type="button" onClick={() => removeComponent(i)} className="p-1 rounded hover:text-red-400 transition-colors" style={{ color: 'var(--color-text-subtle)' }}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Atajo opcional: pegar una lista de códigos ya armada */}
          {!showPaste ? (
            <button
              type="button"
              onClick={() => setShowPaste(true)}
              className="flex items-center gap-1.5 text-xs font-medium hover:underline"
              style={{ color: 'var(--color-primary)' }}
            >
              <ClipboardPaste size={13} /> ¿Ya tenés una lista de códigos? Pegala y la busco sola
            </button>
          ) : (
            <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--color-surface-raised)', border: '1px dashed var(--color-border)' }}>
              <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                <ClipboardPaste size={13} /> Pegá la lista de códigos (opcional)
              </label>
              <p className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
                Un atajo para cuando ya tenés los códigos escritos en algún lado (un Excel, una charla con ChatGPT, un mail del proveedor). Se buscan en el catálogo y se agregan solos. Si no, usá el buscador de arriba.
              </p>
              <textarea
                rows={3}
                placeholder={'Un código por línea. Podés poner cantidades:\nDS-2CD1043G2-I x2\nDS-7104HQHI-K1\nKIT-INSTAL x1'}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm resize-none outline-none font-mono"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" loading={resolving} onClick={handleResolvePaste} disabled={!pasteText.trim()}>
                  Buscar y agregar
                </Button>
                <button type="button" onClick={() => { setShowPaste(false); setPasteText('') }} className="text-xs hover:underline" style={{ color: 'var(--color-text-subtle)' }}>
                  Cerrar
                </button>
              </div>
            </div>
          )}

          {/* Precio + moneda + marcación */}
          <div className="grid sm:grid-cols-3 gap-3">
            <Input
              label="Precio final del KIT *"
              type="number" min="0" step="0.01" placeholder="0.00"
              value={form.price}
              onChange={(e) => {
                // Edición manual del precio → soltamos el campo "Marcación %".
                setMarkupDraft('')
                setForm((f) => ({ ...f, price: e.target.value }))
              }}
            />
            <Select
              label="Moneda"
              options={CURRENCY_OPTIONS}
              value={form.currency}
              onChange={(e) => { setCurrencyTouched(true); setForm((f) => ({ ...f, currency: e.target.value })) }}
            />
            <Input
              label="Marcación %"
              type="number" min="0" step="1"
              placeholder={totals.subtotal > 0 ? totals.marcacionPct.toFixed(0) : '—'}
              value={markupDraft}
              onChange={(e) => {
                const v = e.target.value
                setMarkupDraft(v)
                const mk = Number(v)
                if (v.trim() !== '' && !isNaN(mk) && totals.subtotal > 0) {
                  setForm((f) => ({ ...f, price: (totals.subtotal * (1 + mk / 100)).toFixed(2) }))
                }
              }}
            />
          </div>
          <p className="text-[11px] -mt-1" style={{ color: 'var(--color-text-subtle)' }}>
            Poné el precio a mano, o escribí una <b>marcación</b> (ej. 40) y te calcula el precio: costo × 1,40.
          </p>

          {/* Aviso de moneda desalineada */}
          {(totals.currencyMismatch || totals.mixedCurrency) && (
            <div className="rounded-xl p-3 text-xs flex items-start gap-2" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#d97706' }}>
              <TriangleAlert size={14} className="shrink-0 mt-0.5" />
              {totals.mixedCurrency ? (
                <span>Los componentes tienen monedas distintas ({totals.monedas.join(', ')}). El costo total no es real hasta que estén todos en la misma moneda.</span>
              ) : (
                <span className="flex-1">
                  Los componentes están en <b>{totals.componentsCurrency}</b> y el KIT en <b>{form.currency}</b> — el costo y el margen de abajo mezclan monedas.{' '}
                  <button
                    type="button"
                    className="underline font-semibold"
                    onClick={() => { setCurrencyTouched(true); setForm((f) => ({ ...f, currency: totals.componentsCurrency! })) }}
                  >
                    Pasar el KIT a {totals.componentsCurrency}
                  </button>
                </span>
              )}
            </div>
          )}

          <div className="rounded-xl p-3 text-xs space-y-1" style={{ background: 'var(--color-surface-raised)' }}>
            <div className="flex justify-between" style={{ color: 'var(--color-text-muted)' }}>
              <span>Costo de componentes ({totals.count}) — interno</span>
              <span>{formatCurrency(totals.subtotal, form.currency)}</span>
            </div>
            <div className="flex justify-between" style={{ color: 'var(--color-text)' }}>
              <span>Precio final del KIT (lo que ve el cliente)</span>
              <span className="font-semibold">{formatCurrency(totals.price, form.currency)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-0.5" style={{ color: totals.margen >= 0 ? '#10b981' : '#ef4444' }}>
              <span>Ganancia</span>
              <span>{formatCurrency(totals.margen, form.currency)}</span>
            </div>
            <div className="flex justify-between" style={{ color: 'var(--color-text-muted)' }}>
              <span>· Margen <span style={{ color: 'var(--color-text-subtle)' }}>(sobre el precio de venta)</span></span>
              <span>{totals.margenPct.toFixed(0)}%</span>
            </div>
            <div className="flex justify-between" style={{ color: 'var(--color-text-muted)' }}>
              <span>· Marcación <span style={{ color: 'var(--color-text-subtle)' }}>(sobre el costo)</span></span>
              <span>{totals.marcacionPct.toFixed(0)}%</span>
            </div>
            {totals.unresolved > 0 && (
              <p className="text-red-400 pt-1">{totals.unresolved} código(s) sin match — se ignoran al guardar.</p>
            )}
          </div>

          {priceInvalid && form.components.some((c) => c.productId) && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <TriangleAlert size={13} className="shrink-0" /> Falta el <b>precio final del KIT</b> — cargalo (o poné una marcación) para poder crear el KIT.
            </p>
          )}

          <ModalFooter>
            <Button type="button" variant="ghost" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={saving} disabled={priceInvalid}>{editing ? 'Guardar KIT' : 'Crear KIT'}</Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete */}
      <Modal open={!!deleteKit} onClose={() => setDeleteKit(null)} title="Eliminar KIT" size="sm">
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          ¿Eliminar el KIT <strong style={{ color: 'var(--color-text)' }}>{deleteKit?.name}</strong>? Los productos que lo componen no se tocan. Las cotizaciones ya hechas con este KIT quedan como están.
        </p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setDeleteKit(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>Eliminar</Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
