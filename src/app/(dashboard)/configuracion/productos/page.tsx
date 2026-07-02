'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Plus, ArrowLeft, Pencil, Trash2, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import type { Product } from '@/types'
import toast from 'react-hot-toast'

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD — Dólar' },
  { value: 'ARS', label: 'ARS — Peso arg.' },
  { value: 'EUR', label: 'EUR — Euro' },
]

const EMPTY_FORM = { name: '', description: '', price: '', currency: 'USD', unit: 'unidad' }

export default function ProductosPage() {
  const router = useRouter()
  const qc     = useQueryClient()
  const { user } = useAuthStore()

  const [showModal,  setShowModal]  = useState(false)
  const [editing,    setEditing]    = useState<Product | null>(null)
  const [deleteId,   setDeleteId]   = useState<string | null>(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  const { data, isLoading } = useQuery<{ data: Product[] }>({
    queryKey: ['products'],
    queryFn:  async () => (await fetch('/api/products')).json(),
    staleTime: 30_000,
  })
  const products = data?.data ?? []

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true) }
  const openEdit   = (p: Product) => {
    setEditing(p)
    setForm({ name: p.name, description: p.description ?? '', price: String(p.price), currency: p.currency, unit: p.unit })
    setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(EMPTY_FORM) }

  const canManage = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim())        { toast.error('El nombre es requerido'); return }
    if (!form.price || isNaN(Number(form.price))) { toast.error('Precio inválido'); return }

    setSaving(true)
    try {
      const body = {
        name:        form.name.trim(),
        description: form.description.trim() || null,
        price:       Number(form.price),
        currency:    form.currency,
        unit:        form.unit.trim() || 'unidad',
      }
      const url    = editing ? `/api/products/${editing.id}` : '/api/products'
      const method = editing ? 'PATCH' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json   = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success(editing ? 'Producto actualizado' : 'Producto creado')
      qc.invalidateQueries({ queryKey: ['products'] })
      closeModal()
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res  = await fetch(`/api/products/${deleteId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success('Producto eliminado')
      qc.invalidateQueries({ queryKey: ['products'] })
      setDeleteId(null)
    } catch { toast.error('Error de conexión') } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/configuracion')}
            className="p-2 rounded-lg hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-text-muted)' }}>
            <ArrowLeft size={18} />
          </button>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-primary)' }}>
            <Package size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Productos</h1>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Catálogo de productos físicos para cotizaciones
            </p>
          </div>
        </div>
        {canManage && (
          <Button leftIcon={<Plus size={15} />} onClick={openCreate}>
            Nuevo Producto
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Nombre</th>
              <th className="px-4 py-3 text-left font-semibold hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>Descripción</th>
              <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>Unidad</th>
              <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Precio</th>
              {canManage && <th className="px-4 py-3 w-20" />}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>Cargando...</td></tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Package size={32} className="mx-auto mb-3" style={{ color: 'var(--color-text-subtle)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>No hay productos aún</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>Agregá productos físicos como cámaras, kits de instalación, etc.</p>
                </td>
              </tr>
            ) : products.map(p => (
              <tr key={p.id} style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                className="hover:bg-[var(--color-surface-raised)] transition-colors">
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(99,102,241,0.1)' }}>
                      <Package size={13} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    {p.name}
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>
                  {p.description ?? <span style={{ color: 'var(--color-text-subtle)' }}>—</span>}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                    {p.unit}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--color-text)' }}>
                  {formatCurrency(p.price, p.currency)}
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(p)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
                        style={{ color: 'var(--color-text-muted)' }}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleteId(p.id)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-400"
                        style={{ color: 'var(--color-text-muted)' }}>
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

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={closeModal} title={editing ? 'Editar Producto' : 'Nuevo Producto'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre *"
            placeholder="Ej: Cámara IP 4MP, Kit de instalación"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Descripción</label>
            <textarea
              rows={2}
              placeholder="Características del producto..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all"
              style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Precio *"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            />
            <Select
              label="Moneda"
              options={CURRENCY_OPTIONS}
              value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
            />
          </div>
          <Input
            label="Unidad"
            placeholder="unidad, cámara, kit, metro, hora..."
            value={form.unit}
            onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
          />
          <ModalFooter>
            <Button type="button" variant="ghost" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={saving}>{editing ? 'Guardar' : 'Crear Producto'}</Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar Producto" size="sm">
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          ¿Seguro que querés eliminar este producto? Esta acción no se puede deshacer.
        </p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>Eliminar</Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
